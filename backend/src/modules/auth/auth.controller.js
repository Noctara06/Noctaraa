const service = require("./auth.service");

async function signup(req, res, next) {
  try {
    const session = await service.signup(req.body || {});
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const session = await service.login(req.body || {});
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const session = await service.refresh(req.body || {});
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const session = await service.changePassword(req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const result = await service.logout(req.body || {});
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  refresh,
  changePassword,
  logout
};
