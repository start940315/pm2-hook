
module.exports = function (payload, conf) {
  return payload[conf.token_name] === conf.token_value;
};
