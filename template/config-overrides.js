const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require('webpack');
const webpackBar = require('webpackbar');

//�ر�.map�ļ�������
process.env.GENERATE_SOURCEMAP='false';

//����react-app-rewired��loaderNameMatches
const loaderNameMatches = function(rule, loader_name) {
  return rule && rule.loader && typeof rule.loader === 'string' &&
    (rule.loader.indexOf(`${path.sep}${loader_name}${path.sep}`) !== -1 ||
    rule.loader.indexOf(`@${loader_name}${path.sep}`) !== -1);
};

//����react-app-rewired��getLoader
const getLoader = function(rules, matcher) {
  let loader;

  rules.some(rule => {
    return (loader = matcher(rule)
      ? rule
      : getLoader(rule.use || rule.oneOf || (Array.isArray(rule.loader) && rule.loader) || [], matcher));
  });

  return loader;
};

//����react-app-rewired-less��createRewireLess
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
  //�µĲ���ע��babel-import���ɰ��赼��antd
  //ע��less,modifyVars: { "@primary-color": "#1DA57A" },�뵽index.less�༭
  config = createRewireLess({
	// modifyVars: { "@primary-color": "#1DA57A" },
	javascriptEnabled: true,
  })(config, env);
  //�����ڲ�Ʒģʽ��ִ��
  if(env==='production')
  {
	  let plugins = config.plugins;
	  //�ر�Ĭ��chunk�����ɣ���staticĿ¼������main.js��main.css
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

	  //�����ÿ�����vendor.js,���������������������Ĺ��ÿ�
	  config.entry = {
					  main:config.entry,
					  vendor:["react","react-dom","moment","@ant-design/icons/lib/dist.js"]
	  };

	  //���ʱ����ʾ������
	  plugins.push(new webpackBar({profile:true}));	 
	  //ע�����������gzipѹ��������ͬʱ
	  //plugins.push(new BundleAnalyzerPlugin());
	  plugins.push(new CompressionPlugin({
				algorithm: 'gzip',
				filename:'[path]',
				test: /\.(js|css)$/,
			})
	  );
      //�������ļ�Ҳ�����js|css,��С���ƴ�10000�޸ĵ�20000
	  const urlloader = getLoader(
		config.module.rules,
		rule => loaderNameMatches(rule, "url-loader")
	  );
	  urlloader.test = urlloader.test.concat(/\.(woff|woff2|svg|eot|ttf)\??.*$/);
	  urlloader.options.limit=20000;
	
	  //�ر�css��ѹ����css��ѹ���ᵼ����antd��ie����ʾ��һ������
	  config.optimization.minimizer.splice(1,1);
	  //�رղ�����main~runtime
	  config.optimization.runtimeChunk=false;
	  //���������vendor,ʹ��undefined,����vendorʹ�ú��������
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
