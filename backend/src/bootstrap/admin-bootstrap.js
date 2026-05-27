const prisma = require("../config/prisma");
const env = require("../config/env");
const { ROLES } = require("../common/auth/rbac");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function ensureRole(roleName) {
  return prisma.role.upsert({
    where: {
      name: roleName
    },
    update: {},
    create: {
      name: roleName
    }
  });
}

async function bootstrapAdminUsers() {
  const configuredEmails = [...new Set((env.bootstrapAdminEmails || []).map(normalizeEmail).filter(Boolean))];
  if (!configuredEmails.length) {
    return {
      configured: 0,
      promoted: 0,
      missing: []
    };
  }

  const adminRole = await ensureRole(ROLES.ADMIN);
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: configuredEmails
      }
    },
    include: {
      role: true
    }
  });

  const foundEmails = new Set(users.map((user) => normalizeEmail(user.email)));
  const promoteIds = users
    .filter((user) => normalizeEmail(user.role?.name) !== ROLES.ADMIN)
    .map((user) => user.id);

  if (promoteIds.length) {
    await prisma.user.updateMany({
      where: {
        id: {
          in: promoteIds
        }
      },
      data: {
        roleId: adminRole.id
      }
    });
  }

  const missing = configuredEmails.filter((email) => !foundEmails.has(email));
  console.log(
    `[bootstrap] Admin bootstrap checked ${configuredEmails.length} email(s); promoted ${promoteIds.length}; missing ${missing.length}.`
  );

  if (missing.length) {
    console.warn(`[bootstrap] No user found yet for: ${missing.join(", ")}`);
  }

  return {
    configured: configuredEmails.length,
    promoted: promoteIds.length,
    missing
  };
}

module.exports = {
  bootstrapAdminUsers
};
