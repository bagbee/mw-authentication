
const _ = require('underscore');
const AppUtils = require('app-utils');

const mongoose = module.parent.require('mongoose');

const AppError = AppUtils.AppError;
const jwt = AppUtils.token;

const DEFAULT_AUTH_SCHEME = 'JWT';

function parseAuthHeader(header) {
  if (typeof header !== 'string') {
    return {};
  }
  const matches = header.match(/(\S+)\s+(\S+)/);
  return matches ? { scheme: matches[1], token: matches[2] } : {};
}

function jwtAuth(headers) {
  return new Promise((resolve, reject) => {
    //noinspection JSUnresolvedVariable
    const auth = parseAuthHeader(headers.authorization);

    if (auth.scheme !== DEFAULT_AUTH_SCHEME) {
      return reject(new AppError('Authorization header is not valid', 401));
    } else if (!auth.token) {
      return reject(new AppError('Request hasn\'t access token', 401));
    }

    const token = auth.token;
    //noinspection JSUnresolvedFunction
    const result = jwt.decode(token)
      .then(decoded => this.user.findById(decoded.iss));

    resolve(result);
  });
}

function apikeyAuth(body) {
  return new Promise((resolve, reject) => {
    const apikey = body.apikey;
    if (!apikey) {
      reject(new AppError(_.isUndefined(apikey) ? 'Request hasn\'t apikey' : 'Apikey is not valid', 401));
    }
    resolve(this.user.findOne({ apikey }));
  });
}


module.exports = function Auth(model) {
  this.user = mongoose.model(model);

  this.authorize = (schema = 'jwt') => (ctx, next) => {
    let result;
    if (schema === 'jwt') {
      result = jwtAuth.call(this, ctx.request.headers);
    } else if (schema === 'apikey') {
      result = apikeyAuth.call(this, ctx.request.body);
    } else {
      throw new AppError('Unsupported authorization schema');
    }

    return result
      .then((user) => {
        if (!user) {
          throw new AppError(401);
        }
        ctx._user = user;
        return next();
      });
  };

  this.tryAuthorize = (schema = 'jwt') => (ctx, next) => {
    let result;
    if (schema === 'jwt') {
      result = jwtAuth.call(this, ctx.request.headers);
    } else if (schema === 'apikey') {
      result = apikeyAuth.call(this, ctx.request.body);
    } else {
      throw new AppError('Unsupported authorization schema');
    }

    return result
      .then((user) => {
        if (!user) {
          throw new AppError(401);
        }
        ctx._user = user;
        return next();
      });
  };

  this.requireRoles = roles => (ctx, next) => {
    //noinspection JSCheckFunctionSignatures
    if (ctx._user && _.intersection(ctx._user.roles || [], roles).length > 0) {
      return next();
    }
    throw new AppError(403);
  };
};
