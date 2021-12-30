const path = require('path');
const fs = require('fs');
const babylon = require('babylon');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generator = require('@babel/generator').default;
const ejs = require('ejs')
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
  }
  getSource(modulePath) {
    return fs.readFileSync(modulePath,'utf8');
  }
  parse (source,parentPatch) { // AST 解析语法树
   const ast = babylon.parse(source);
   let dependencies = []; // 依赖数组
   traverse(ast,{
     CallExpression(p) {
       const node = p.node;
       if(node.callee.name == 'require') {
         node.callee.name = '__webpack_require__';
         let moduleName = node.arguments[0].value; // 模块名字
         moduleName = moduleName + (path.extname(moduleName)?'':'.js'); // ./a.js
         moduleName = './' + path.join(parentPatch,moduleName); // src/a.js
         dependencies.push(moduleName);
         node.arguments = [t.stringLiteral(moduleName)];
       }
     }
   });
   const sourceCode = generator(ast).code;
    return {
      sourceCode,dependencies}

  }
  buildModule(modulePath,isEntry) {
    // 拿到模块内容
   const source = this.getSource(modulePath);
   // 模块id
    const moduleName = './' + path.relative(this.root,modulePath);
    if(isEntry) {
      this.entryId = moduleName;
    }
    // 解析源码需要把source 源码进行改造，返回一个依赖列表
    const {sourceCode,dependencies} = this.parse(source,path.dirname(moduleName)); // ./src
    // 把相对路径和模块中的内容，对应起来
    this.modules[moduleName] = sourceCode;
    dependencies.forEach((dep) => { // 递归加载模块
      this.buildModule(path.join(this.root,dep),false)
    })
  }
  emitFile() {
    const {output} = this.config;
    const main = path.join(output.path,output.filename);
    let templateStr = this.getSource(path.join(__dirname,'main.ejs'));
    console.log('this.modules',this.modules)
    const code = ejs.render(templateStr,{entryId:this.entryId,modules:this.modules});
    this.assets = {};
    this.assets[main] = code;
    fs.writeFileSync(main,this.assets[main])
  }
  run() {
    // 执行，并且创建模块的依赖关系
    this.buildModule(path.resolve(this.root,this.entry),true);
    // 发射一个文件，打包后的文件
    this.emitFile();
  }
}
module.exports = Compiler;