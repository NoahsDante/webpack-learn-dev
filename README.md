# webpack-learn-dev
手写webpack


## 编译产物分析

```javascript
 (() => {
   // 模块依赖
 var __webpack_modules__ = ({

	 "./src/index.js":
		 ((module, __unused_webpack_exports, __webpack_require__) => {
       // 执行模块代码其中 同时执行__webpack_require__ 引用代码
			 eval(`const str = __webpack_require__("./src/a.js");

console.log(str);`);
		 }),

	 "./src/a.js":
		 ((module, __unused_webpack_exports, __webpack_require__) => {
			 eval(`const b = __webpack_require__("./src/base/b.js");

module.exports = 'a' + b;`);
		 }),

	 "./src/base/b.js":
		 ((module, __unused_webpack_exports, __webpack_require__) => {
			 eval(`module.exports = 'b';`);
		 }),

 });
 var __webpack_module_cache__ = {};
 function __webpack_require__(moduleId) {
   // 获取_webpack_module_cache__ 是否有exports值 
	 var cachedModule = __webpack_module_cache__[moduleId];
   // 如果已经有了，不用再执行模块代码
	 if (cachedModule !== undefined) {
		 return cachedModule.exports;
	 }
	 var module = __webpack_module_cache__[moduleId] = {
		 exports: {}
	 };
   // 根据moduleId 模块文件路径，找到模块代码并执行传入 module, module.exports, __webpack_require__
	 __webpack_modules__[moduleId](module, module.exports, __webpack_require__);

	 return module.exports;
 }
   // 执行入口文件代码
 var __webpack_exports__ = __webpack_require__("./src/index.js");
 })()
```

以上代码是通过精简过的，可以看到以下工具函数

- __webpack_modules__:是一个对象，它的值是所有模块的代码，key值对应是模块文件路径
- __webpack_module_cache__: 缓存exports的值

- __webpack_require__:加载模块代码，根据模块文件路径
- __webpack_exports__:模块对外暴露方法

通过以上工具方法，就可以在浏览器run起来；从源代码es6、es7 新特性新写法，都需要转成浏览器可识别的代码；

如:

```javascript
// es6
import 

// es5 
__webpack_require__
```

webpack通过自定义__webpack_require__、__webpack_exports__ ...,实现多个模块代码打包。

接下来将按照上述逻辑，来构建简易版的webpack，通过以下几个阶段

1. 配置信息
2. 依赖构建

1. 生成模版代码
2. 生成文件

## 配置信息

```javascript
class Compiler {
  constructor(config) {
    // 获取配置信息
    this.config = config;
    // 保存入口路径
    this.entryId;
    // 模块依赖关系
    this.modules = {};
    // 入口路径
    this.entry = config.entry;
    // 工作路径
    this.root = process.cwd();
  }
```

## 构建依赖

```javascript
getSource(modulePath) {
    const rules = this.config.module.rules;
    let content = fs.readFileSync(modulePath, 'utf8');
    return content;
  }
buildModule(modulePath, isEntry) {
    // 拿到模块内容
    const source = this.getSource(modulePath);
    // 模块id
    const moduleName = './' + path.relative(this.root, modulePath);
    if (isEntry) {
      this.entryId = moduleName;
    }
    // 解析源码需要把source 源码进行改造，返回一个依赖列表
    const {sourceCode, dependencies} = this.parse(source, path.dirname(moduleName)); // ./src
    // 把相对路径和模块中的内容，对应起来
    this.modules[moduleName] = sourceCode;
    dependencies.forEach((dep) => { // 递归加载模块
      this.buildModule(path.join(this.root, dep), false)
    })
  }
```

通过`buildModule`解析源码，形成模块依赖`this.modules[moduleName`；

- 找到模块源码`this.getSource(modulePath);`
- 解析源码，转换ast，返回源码和模块依赖路径`this.parse(source, path.dirname(moduleName))`

- 生成路径与模块代码对象：`this.modules[moduleName] = sourceCode`
- 对模块中有依赖的文件，形成迭代调用`this.buildModule(path.join(this.root, dep), false)`重新执行以上方法



**解析源码**

```javascript
  parse(source, parentPatch) { // AST 解析语法树
    const ast = babylon.parse(source);
    let dependencies = []; // 依赖数组
    traverse(ast, {
      CallExpression(p) {
        const node = p.node;
        if (node.callee.name == 'require') {
          node.callee.name = '__webpack_require__';
          let moduleName = node.arguments[0].value; // 模块名字
          moduleName = moduleName + (path.extname(moduleName) ? '' : '.js'); // ./a.js
          moduleName = './' + path.join(parentPatch, moduleName); // src/a.js
          dependencies.push(moduleName);
          node.arguments = [t.stringLiteral(moduleName)];
        }
      }
    });
    const sourceCode = generator(ast).code;
    return {
      sourceCode, dependencies
    }

  }
```

解析模块源代码，替换require方法成`__webpack_require__`，同时把文件路径也转换掉

## 代码生成模版

```javascript
// ejs  模版代码
(() => {
var __webpack_modules__ = ({
<%for(let key in modules){%>
    "<%-key%>":
    ((module, __unused_webpack_exports, __webpack_require__) => {
      eval(`<%-modules[key]%>`);
     }),
<%}%>
});
var __webpack_module_cache__ = {};
function __webpack_require__(moduleId) {
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
var module = __webpack_module_cache__[moduleId] = {
exports: {}
};

__webpack_modules__[moduleId](module, module.exports, __webpack_require__);

return module.exports;
}
var __webpack_exports__ = __webpack_require__("<%-entryId%>");
})()
;
```

将把`this.modules`、`this.entryId`数据，传入此模版中，生成可执行代码

## 生成文件

```javascript
  emitFile() {
    const {output} = this.config;
    const main = path.join(output.path, output.filename);
    // 模块字符串
    let templateStr = this.getSource(path.join(__dirname, 'main.ejs'));
    // 生成代码
    const code = ejs.render(templateStr, {entryId: this.entryId, modules: this.modules});
    this.assets = {};
    this.assets[main] = code;
    // 将代码写入output文件夹/文件
    fs.writeFileSync(main, this.assets[main])
  }
```

## loader

```
将引用资源，转换成模块
 getSource(modulePath) {
    const rules = this.config.module.rules;
    let content = fs.readFileSync(modulePath, 'utf8');
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const {test,use} = rule;
        let len = use.length -1
        if(test.test(modulePath)) {
          function normalLoader() {
            const loader = require(use[len--]);
            content = loader(content);
            if(len >= 0) {
              normalLoader();
            }
          }
          normalLoader();
        }
    }
    return content;
  }
```

根据路径获取源码，判断当前路径是否能匹配上loader文件`test.test(modulePath)`，

如果可以匹配，将模块源码传入，loader方法中，再做其他转换` content = loader(content);`并且形成递归调用；

```javascript
// 自定义loader

// less-loader
const {render} = require('less')
function loader(source) {
  let css = '';

  render(source,(err,c) => {
    css = c;
  })
  css = css.replace(/\n/g,'\\n')
  return css;
}

module.exports = loader;

// style-loader

function loader(source) {
 let style = `
  let style = document.createElement('style')
  style.innerHTML = ${JSON.stringify(source)}
  document.head.appendChild(style);
 `;

 return style;
}
module.exports = loader;
```

配置文件

```json
const path = require('path');
module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    filename: 'bundle2.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.less$/,
        use:[
          path.resolve(__dirname,'loader','style-loader'), // 后执行
          path.resolve(__dirname,'loader','less-loader') // 先执行
        ]
      }
    ]
  },
}
```

## plugin

从形态上看，插件通常是一个带有 apply 函数的类：

```javascript
class SomePlugin {
    apply(compiler) {
    }
}
```

apply 函数运行时会得到参数 compiler ，以此为起点可以调用 hook 对象注册各种钩子回调，

例如：compiler.hooks.make.tapAsync ，这里面 make 是钩子名称，tapAsync 定义了钩子的调用方式，

webpack 的插件架构基于这种模式构建而成，插件开发者可以使用这种模式在钩子回调中，插入特定代码

配置文件

```javascript
const path = require('path');

class P {
  constructor() {

  }
  apply(compiler) {
    // 获取compiler上方法，注册各个阶段回调
    compiler.hooks.emit.tap('emit',function () {
      console.log('emit')
    })
  }
}

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    filename: 'bundle2.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new P()
  ]
}
```

**compiler.js**

```javascript
const {SyncHook} = require('tapable');
class Compiler {
  constructor(config) {
    this.config = config;
    // 保存入口路径
    this.entryId;
    // 模块依赖关系
    this.modules = {};
    // 入口路径
    this.entry = config.entry;
    // 工作路径
    this.root = process.cwd();
    // 开始注册同步发布订阅
    this.hooks = {
      entryOption:new SyncHook(),
      compile:new  SyncHook(),
      afterCompile:new SyncHook(),
      afterPlugins:new SyncHook(),
      run:new SyncHook(),
      emit:new SyncHook(),
      done:new SyncHook()
    };

    const plugins = this.config.plugins;
    // 拿到配置项里的plugin 
    if(Array.isArray(plugins)) {
      plugins.forEach((plugin) => {
        // 调用plugin 中实例方法 apply，并传入整个Compiler 类
        plugin.apply(this);
      })
    }
    this.hooks.afterPlugins.call();
  }
```

plugin 核心就是`tapable`采用发布/订阅的模式，先搜集/订阅插件中所需要回调，在webpack生命周期中去执行，这样插件就可以在使用的时机，获取想要的上下文，从而进行干预以及其他操作。

以上就是各个阶段关键核心代码部分

## 完整代码

```javascript
const path = require('path');
const fs = require('fs');
const babylon = require('babylon');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generator = require('@babel/generator').default;
const ejs = require('ejs');
const {SyncHook} = require('tapable');
// babylon 解析 js 转换 ast
// https://www.astexplorer.net/
// @babel/travers
// @babel/types
// @babel/generator
class Compiler {
  constructor(config) {
    this.config = config;
    // 保存入口路径
    this.entryId;
    // 模块依赖关系
    this.modules = {};
    // 入口路径
    this.entry = config.entry;
    // 工作路径
    this.root = process.cwd();

    this.hooks = {
      entryOption:new SyncHook(),
      compile:new  SyncHook(),
      afterCompile:new SyncHook(),
      afterPlugins:new SyncHook(),
      run:new SyncHook(),
      emit:new SyncHook(),
      done:new SyncHook()
    };

    const plugins = this.config.plugins;
    if(Array.isArray(plugins)) {
      plugins.forEach((plugin) => {
        plugin.apply(this);
      })
    }
    this.hooks.afterPlugins.call();
  }

  getSource(modulePath) {
    const rules = this.config.module.rules;
    let content = fs.readFileSync(modulePath, 'utf8');
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const {test,use} = rule;
        let len = use.length -1
        if(test.test(modulePath)) {
          function normalLoader() {
            const loader = require(use[len--]);
            content = loader(content);
            if(len >= 0) {
              normalLoader();
            }
          }
          normalLoader();
        }
    }
    return content;
  }

  parse(source, parentPatch) { // AST 解析语法树
    const ast = babylon.parse(source);
    let dependencies = []; // 依赖数组
    traverse(ast, {
      CallExpression(p) {
        const node = p.node;
        if (node.callee.name == 'require') {
          node.callee.name = '__webpack_require__';
          let moduleName = node.arguments[0].value; // 模块名字
          moduleName = moduleName + (path.extname(moduleName) ? '' : '.js'); // ./a.js
          moduleName = './' + path.join(parentPatch, moduleName); // src/a.js
          dependencies.push(moduleName);
          node.arguments = [t.stringLiteral(moduleName)];
        }
      }
    });
    const sourceCode = generator(ast).code;
    return {
      sourceCode, dependencies
    }

  }

  buildModule(modulePath, isEntry) {
    // 拿到模块内容
    const source = this.getSource(modulePath);
    // 模块id
    const moduleName = './' + path.relative(this.root, modulePath);
    if (isEntry) {
      this.entryId = moduleName;
    }
    // 解析源码需要把source 源码进行改造，返回一个依赖列表
    const {sourceCode, dependencies} = this.parse(source, path.dirname(moduleName)); // ./src
    // 把相对路径和模块中的内容，对应起来
    this.modules[moduleName] = sourceCode;
    dependencies.forEach((dep) => { // 递归加载模块
      this.buildModule(path.join(this.root, dep), false)
    })
  }

  emitFile() {
    const {output} = this.config;
    const main = path.join(output.path, output.filename);
    let templateStr = this.getSource(path.join(__dirname, 'main.ejs'));
    const code = ejs.render(templateStr, {entryId: this.entryId, modules: this.modules});
    this.assets = {};
    this.assets[main] = code;
    fs.writeFileSync(main, this.assets[main])
  }

  run() {
    this.hooks.run.call();
    this.hooks.compile.call();
    // 执行，并且创建模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true);
    this.hooks.afterCompile.call();
    // 发射一个文件，打包后的文件
    this.emitFile();
    this.hooks.emit.call();
    this.hooks.done.call();
  }
}

module.exports = Compiler;
```

github链接：

https://github.com/NoahsDante/webpack-learn-dev
