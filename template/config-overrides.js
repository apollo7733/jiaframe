const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require('webpack');
const webpackBar = require('webpackbar');

//关闭.map文件的生成
process.env.GENERATE_SOURCEMAP='false';

//复制react-app-rewired的loaderNameMatches
const loaderNameMatches = function(rule, loader_name) {
  return rule && rule.loader && typeof rule.loader === 'string' &&
    (rule.loader.indexOf(`${path.sep}${loader_name}${path.sep}`) !== -1 ||
    rule.loader.indexOf(`@${loader_name}${path.sep}`) !== -1);
};

//复制react-app-rewired的getLoader
const getLoader = function(rules, matcher) {
  let loader;

  rules.some(rule => {
    return (loader = matcher(rule)
      ? rule
      : getLoader(rule.use || rule.oneOf || (Array.isArray(rule.loader) && rule.loader) || [], matcher));
  });

  return loader;
};

//复制react-app-rewired-less的createRewireLess
function createRewireLess(lessLoaderOptions = {}) {
  return function(config, env) {
    const lessExtension = /\.less$/;

    const fileLoader = getLoader(
      config.module.rules,
      rule => loaderNameMatches(rule, 'file-loader')
    );
    fileLoader.exclude.push(lessExtension);

    const cssRules = getLoader(
      config.module.rules,
      rule => String(rule.test) === String(/\.css$/)
    );

    let lessRules;
    if (env === "production") {
      const lessLoader = cssRules.loader || cssRules.use

      lessRules = {
        test: lessExtension,
        loader: [
          // TODO: originally this part is wrapper in extract-text-webpack-plugin
          //       which we cannot do, so some things like relative publicPath
          //       will not work.
          //       https://github.com/timarney/react-app-rewired/issues/33
          ...lessLoader,
          { loader: "less-loader", options: lessLoaderOptions }
        ]
      };
    } else {
      lessRules = {
        test: lessExtension,
        use: [
          ...cssRules.use,
          { loader: "less-loader", options: lessLoaderOptions }
        ]
      };
    }

    const oneOfRule = config.module.rules.find((rule) => rule.oneOf !== undefined);
    if (oneOfRule) {
      oneOfRule.oneOf.unshift(lessRules);
    }
    else {
      // Fallback to previous behaviour of adding to the end of the rules list.
      config.module.rules.push(lessRules);
    }

    return config;
  };
}

module.exports = function override(config, env) {
  //新的不用注入babel-import即可按需导入antd
  //注入less,modifyVars: { "@primary-color": "#1DA57A" },请到index.less编辑
  config = createRewireLess({
	// modifyVars: { "@primary-color": "#1DA57A" },
	javascriptEnabled: true,
  })(config, env);
  //以下在产品模式才执行
  if(env==='production')
  {
	  let plugins = config.plugins;
	  //关闭默认chunk的生成，在static目录下生成main.js和main.css
	  config.output.filename='static/[name].js';
	  config.output.chunkFilename='static/[name].js';
	  for(const i in plugins)
	  {
		  if('MiniCssExtractPlugin'===plugins[i].constructor.name)
		  {
			  plugins[i] = new MiniCssExtractPlugin({
				filename: 'static/[name].css',
				chunkFilename: 'static/[name].chunk.css',
			  });
		  }
	  }

	  //将公用库打包到vendor.js,你可以在这里添加你新增的公用库
	  config.entry = {
					  main:config.entry,
					  vendor:["react","react-dom","moment","@ant-design/icons/lib/dist.js"]
	  };

	  //打包时候显示进度条
	  plugins.push(new webpackBar({profile:true}));	 
	  //注：打包分析和gzip压缩不可以同时
	  //plugins.push(new BundleAnalyzerPlugin());
	  plugins.push(new CompressionPlugin({
				algorithm: 'gzip',
				filename:'[path]',
				test: /\.(js|css)$/,
			})
	  );
      //将字体文件也打包进js|css,大小限制从10000修改到20000
	  const urlloader = getLoader(
		config.module.rules,
		rule => loaderNameMatches(rule, "url-loader")
	  );
	  urlloader.test = urlloader.test.concat(/\.(woff|woff2|svg|eot|ttf)\??.*$/);
	  urlloader.options.limit=20000;
	
	  //关闭css的压缩，css的压缩会导致在antd在ie下显示有一定问题
	  config.optimization.minimizer.splice(1,1);
	  //关闭不生成main~runtime
	  config.optimization.runtimeChunk=false;
	  //如果不生成vendor,使用undefined,生成vendor使用后面的配置
	  //config.optimization.splitChunks=undefined;
	  config.optimization.splitChunks={
            cacheGroups: {
                commons: {
                    name: "vendor",
                    chunks: "initial",
                    minChunks: 2
                }
            }
        };
  }
  return config;
};
