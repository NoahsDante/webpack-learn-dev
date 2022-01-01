const path = require('path');

class P {
  constructor() {

  }
  apply(compiler) {
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
  module: {
    rules: [
      {
        test: /\.less$/,
        use:[
          path.resolve(__dirname,'loader','style-loader'),
          path.resolve(__dirname,'loader','less-loader')
        ]
      }
    ]
  },
  plugins: [
    new P()
  ]
}