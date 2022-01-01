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