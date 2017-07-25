const bunyan = require("bunyan");
const pmx = require('pmx');
const pm2 = require("pm2");
const Koa = require("koa");
const koaBody = require('koa-body');

let log = bunyan.createLogger({
  name: "pm2-web-hook"
});

pmx.initModule({

  // Options related to the display style on Keymetrics
  widget : {

    // Logo displayed
    logo : 'https://app.keymetrics.io/img/logo/keymetrics-300.png',

    // Module colors
    // 0 = main element
    // 1 = secondary
    // 2 = main border
    // 3 = secondary border
    theme            : ['#141A1F', '#222222', '#3ff', '#3ff'],

    // Section to show / hide
    el : {
      // probes  : true,
      // actions : true
    },

    // Main block to show / hide
    block : {
      // actions : false,
      issues  : true,
      meta    : true,

      // Custom metrics to put in BIG
      // main_probes : ['test-probe']
    }

  }

}, function(err, conf) {
  
  let hooks = [];
  function updateApps () {
    pm2.list(function (err, apps) {
      if (err) {
        log.error(`get apps info error:`, err);
      } else {
        apps.filter(app => !!app.pm2_env.env_pm2_web_hook).forEach(app => {
          hooks[app.name] = app.pm2_env.env_pm2_web_hook;
        });
      }
    });
  }
  
  pm2.connect(function (err) {
    if (err) {
      log.error("pm2 connect error", err);
      process.exit(2);
    }
    
    let _port = conf.port;
    let _interval = conf.interval;
    
    let server = new Koa();
  
    server.use(koaBody());
    
    server.use(ctx => {
      ctx.response.status = 204;
      if (ctx.method.toLowerCase() !== "post") return;
      
      let payload = ctx.request.body;
      let doReload = false;
      
      let __config = hooks[ctx.path.replace("/", "")];
      if (!__config) return ;
      
      switch (__config.mode) {
        case "custom":
          doReload = __config.handler(payload, conf);
          break;
        case "normal":
        default:
          doReload = payload[__config.token_name] === __config.token_value;
          break;
      }
      
      if(doReload) {
        let __appName = __config.name;
        pm2.pullAndReload(__appName, function(err, meta) {
          if (!err && meta.rev) {
            log.info(`${_appName} is at latest version:${meta.rev.current_revision}`);
          } else {
            log.error(`Pull ${_appName} failed`, 1, err, 2, meta);
          }
        });
      }
    });
    
    server.listen(_port);
    log.info(`Webhook server listen on ${_port}`);
    
    setInterval(updateApps, _interval);
  });

});
