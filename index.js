const express = require('express') 
const app = express()
const Vue = require('vue') 
const renderer3 = require('@vue/server-renderer')
const vue3Compile= require('@vue/compiler-ssr')

const vueapp = {
  template: `<div>
    <h1 @click="add">点我{{num}}</h1>
    <ul >
      <li v-for="(todo,n) in todos" >{{n+1}}--{{todo}}</li>
    </ul>
  </div>`,
  data(){
    return {
      num:1,
      todos:['111','222','333']
    }
  },
  methods:{
    add(){
      this.num++
    }
  } 
}
// @vue/compiler-ssr解析template 
vueapp.ssrRender = new Function('require',vue3Compile.compile(vueapp.template).code)(require) // 这里设置了 ssrRender渲染方法
// 路由首页返回结果
app.get('/',async function(req,res){
    let vapp = Vue.createSSRApp(vueapp)
    let html = await renderer3.renderToString(vapp) // 这里会获取 ssrRender 生成的html，先插入到 <div id="app">之中
    const title = "test SSR"
    let ret = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="app">
      ${html}
    </div>
  </body>
</html>`    
    res.send(ret)
})
app.listen(10086,()=>{
    console.log('listen 10086')
}) 