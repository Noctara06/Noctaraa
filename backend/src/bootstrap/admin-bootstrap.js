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
  const forcedUserEmails = [...new Set((env.forcedUserEmails || []).map(normalizeEmail).filter(Boolean))];
  const configuredEmails = [...new Set((env.bootstrapAdminEmails || []).map(normalizeEmail).filter(Boolean))]
    .filter((email) => !forcedUserEmails.includes(email));

  if (!configuredEmails.length && !forcedUserEmails.length) {
    return {
      configured: 0,
      promoted: 0,
      demoted: 0,
      missing: []
    };
  }

  const adminRole = await ensureRole(ROLES.ADMIN);
  const userRole = await ensureRole(ROLES.USER);
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [...new Set([...configuredEmails, ...forcedUserEmails])]
      }
    },
    include: {
      role: true
    }
  });

  const foundEmails = new Set(users.map((user) => normalizeEmail(user.email)));
  const demoteIds = users
    .filter((user) => forcedUserEmails.includes(normalizeEmail(user.email)))
    .filter((user) => normalizeEmail(user.role?.name) !== ROLES.USER)
    .map((user) => user.id);
  const promoteIds = users
    .filter((user) => configuredEmails.includes(normalizeEmail(user.email)))
    .filter((user) => normalizeEmail(user.role?.name) !== ROLES.ADMIN)
    .map((user) => user.id);

  if (demoteIds.length) {
    await prisma.user.updateMany({
      where: {
        id: {
          in: demoteIds
        }
      },
      data: {
        roleId: userRole.id
      }
    });
  }

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
    `[bootstrap] Role bootstrap checked ${configuredEmails.length} admin email(s) and ${forcedUserEmails.length} forced-user email(s); promoted ${promoteIds.length}; demoted ${demoteIds.length}; missing ${missing.length}.`
  );

  if (missing.length) {
    console.warn(`[bootstrap] No user found yet for: ${missing.join(", ")}`);
  }

  return {
    configured: configuredEmails.length,
    promoted: promoteIds.length,
    demoted: demoteIds.length,
    missing
  };
}

module.exports = {
  bootstrapAdminUsers
};
