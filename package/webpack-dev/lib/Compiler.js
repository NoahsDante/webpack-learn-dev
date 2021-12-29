const path = require('path');
const fs = require('fs');
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

    console.log(source,parentPatch);
    return {
      sourceCode:{},dependencies:{}
    }
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
  }
  emitFile() {

  }
  run() {
    // 执行，并且创建模块的依赖关系
    this.buildModule(path.resolve(this.root,this.entry),true);

    // 发射一个文件，打包后的文件
    this.emitFile();
  }
}
module.exports = Compiler;