#!/usr/bin/env node
const path = require('path');
const option = require(path.resolve('webpack.config.js'))

const Compiler = require('../lib/Compiler');
const compiler = new Compiler(option);
compiler.hooks.entryOption.call();
compiler.run();