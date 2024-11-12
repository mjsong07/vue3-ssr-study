# 分类
- CSR：Client Side Render
- SSR：Server Side Render

# CSR缺点
- 首屏是个空页面，需要加载完vue库，在客户端进行渲染
- 等待的时间较长
- 由于是客户端渲染，爬虫无法直接获取该网页的信息
  
# 实现

```sh
npm init -y 
npm install @vue/server-renderer vue express --save
```

创建一个服务

index.js
```js
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
```

可以看到请求服务的时候直接输出的vue渲染后的html，但是此时还无法触发事件响应，因为vue没有正常加载
![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/f9dfd5d8da3744859ca49cac05bb204f~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgamFzb25feWFuZw==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjk3MjcwNDc5NTgwMjY1MyJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1731485791&x-orig-sign=NZWCusAi3W5U4jOe6UWZst6dVn4%3D)


vue3 在线演示
https://play.vuejs.org/#eNp9kUFLwzAUx7/KM5cqzBXR0+gGKgP1oKKCl1xG99ZlpklIXuag9Lv7krK5w9it7//7v/SXthP3zo23EcVEVKH2yhEEpOhm0qjWWU/QgccV9LDytoWCq4U00tTWBII2NDBN/LJ4Qq0tfFuvlxfFlTRVORzHB/FA2Dq9IOQJoFrfzLouL/d9VfKUU2VcJNhet3aJeioFcymgZFiVR/tiJCjw61eqGW+CNWzepX0pats6pdG/OVKsJ8UEMklswXa/LzkjH3G0z+s11j8n8k3YpUyKd48B/RalODBa+AZpwPPPV9zx8wGyfdTcPgM/MFgdk+NQe4hmydpHvWz7nL+/Ms1XmO8ITdhfKommZp/7UvA/eTxz9X/d2/Fd3pOmF/0fEx+nNQ==


![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2d0b537dc9df4a66a7c974342f2a1d54~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgamFzb25feWFuZw==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjk3MjcwNDc5NTgwMjY1MyJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1731486471&x-orig-sign=GIq2xKKJ6GUWSsP6CSioLemrHw4%3D)

可以看到主要是通过 _push 函数拼接内容

```js
  _push(`<!--[--><h1>${
    _ssrInterpolate($setup.msg)
  }</h1><input${
    _ssrRenderAttr("value", $setup.msg)
  }><!--]-->`)
```

# 源码分析

packages/compiler-ssr/src/index.ts
## compile

1. 使用baseParse转化成ast
2. transform 优化ast
3. generate生成 render 代码
```js 


export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions

export function compile(
  source: string | RootNode,
  options: CompilerOptions = {},
): CodegenResult {
  options = {
    ...options,
    ...parserOptions,
    ssr: true,
    inSSR: true,
    scopeId: options.mode === 'function' ? null : options.scopeId,
    // always prefix since compiler-ssr doesn't have size concern
    prefixIdentifiers: true,
    // disable optimizations that are unnecessary for ssr
    cacheHandlers: false,
    hoistStatic: false,
  }

  const ast = typeof source === 'string' ? baseParse(source, options) : source // 先转化成ast

  // Save raw options for AST. This is needed when performing sub-transforms
  // on slot vnode branches.
  rawOptionsMap.set(ast, options)

  transform(ast, { // transform 优化ast
    ...options,
    hoistStatic: false,
    nodeTransforms: [
      ssrTransformIf,
      ssrTransformFor,
      trackVForSlotScopes,
      transformExpression,
      ssrTransformSlotOutlet,
      ssrInjectFallthroughAttrs,
      ssrInjectCssVars,
      ssrTransformElement,
      ssrTransformComponent,
      trackSlotScopes,
      transformStyle,
      ...(options.nodeTransforms || []), // user transforms
    ],
    directiveTransforms: {
      // reusing core v-bind
      bind: transformBind,
      on: transformOn,
      // model and show have dedicated SSR handling
      model: ssrTransformModel,
      show: ssrTransformShow,
      // the following are ignored during SSR
      // on: noopDirectiveTransform,
      cloak: noopDirectiveTransform,
      once: noopDirectiveTransform,
      memo: noopDirectiveTransform,
      ...(options.directiveTransforms || {}), // user transforms
    },
  })

  // traverse the template AST and convert into SSR codegen AST
  // by replacing ast.codegenNode.
  ssrCodegenTransform(ast, options)

  return generate(ast, options)
}

```



## renderToString

访问路径 
packages/server-renderer/src/renderToString.ts

1. vnode 调用renderComponentVNode 生成一个buffer流的vnode
2. 通过unrollBuffer 把buffer转化成字符串

```js

export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  if (isVNode(input)) {
    // raw vnode, wrap with app (for context)
    return renderToString(createApp({ render: () => input }), context)
  }

  // rendering an app
  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context
  // provide the ssr context to the tree
  input.provide(ssrContextKey, context)
  const buffer = await renderComponentVNode(vnode) // 这里生成一个buffer流的vnode

  const result = await unrollBuffer(buffer as SSRBuffer)// 这里把buffer 转化为 字符串

  await resolveTeleports(context)

  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch()
    }
  }

  return result
}
```

## renderComponentVNode
packages/server-renderer/src/render.ts

1. renderComponentVNode内部通过renderComponentSubTree 调用子树的渲染
2. renderComponentSubTree 内部通过 ssrRender 进行
3. const { getBuffer, push } = createBuffer()  获取传入的参数
4. createBuffer内部 定义了 const buffer: SSRBuffer = [] 闭包，在调用push的时候，自动添加到 buffer 上面
5. 

```js

export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  const instance = createComponentInstance(vnode, parentComponent, null)
  const res = setupComponent(instance, true /* isSSR */)
  const hasAsyncSetup = isPromise(res)
  const prefetches = instance.sp /* LifecycleHooks.SERVER_PREFETCH */
  if (hasAsyncSetup || prefetches) {
    let p: Promise<unknown> = hasAsyncSetup
      ? (res as Promise<void>)
      : Promise.resolve()
    if (prefetches) {
      p = p
        .then(() =>
          Promise.all(
            prefetches.map(prefetch => prefetch.call(instance.proxy)),
          ),
        )
        // Note: error display is already done by the wrapped lifecycle hook function.
        .catch(NOOP)
    }
    return p.then(() => renderComponentSubTree(instance, slotScopeId))
  } else {
    return renderComponentSubTree(instance, slotScopeId)
  }
}



function renderComponentSubTree(
  instance: ComponentInternalInstance,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  const comp = instance.type as Component
  const { getBuffer, push } = createBuffer() // 这里创建传入的参数
  if (isFunction(comp)) {
    let root = renderComponentRoot(instance)
    // #5817 scope ID attrs not falling through if functional component doesn't
    // have props
    if (!(comp as FunctionalComponent).props) {
      for (const key in instance.attrs) {
        if (key.startsWith(`data-v-`)) {
          ;(root.props || (root.props = {}))[key] = ``
        }
      }
    }
    renderVNode(push, (instance.subTree = root), instance, slotScopeId)
  } else {
    if (
      (!instance.render || instance.render === NOOP) &&
      !instance.ssrRender &&
      !comp.ssrRender &&
      isString(comp.template)
    ) {
      comp.ssrRender = ssrCompile(comp.template, instance)
    }

    // perf: enable caching of computed getters during render
    // since there cannot be state mutations during render.
    for (const e of instance.scope.effects) {
      if (e.computed) {
        e.computed._dirty = true
        e.computed._cacheable = true
      }
    }

    const ssrRender = instance.ssrRender || comp.ssrRender
    if (ssrRender) {
      // optimized
      // resolve fallthrough attrs
      let attrs = instance.inheritAttrs !== false ? instance.attrs : undefined
      let hasCloned = false

      let cur = instance
      while (true) {
        const scopeId = cur.vnode.scopeId
        if (scopeId) {
          if (!hasCloned) {
            attrs = { ...attrs }
            hasCloned = true
          }
          attrs![scopeId] = ''
        }
        const parent = cur.parent
        if (parent && parent.subTree && parent.subTree === cur.vnode) {
          // parent is a non-SSR compiled component and is rendering this
          // component as root. inherit its scopeId if present.
          cur = parent
        } else {
          break
        }
      }

      if (slotScopeId) {
        if (!hasCloned) attrs = { ...attrs }
        const slotScopeIdList = slotScopeId.trim().split(' ')
        for (let i = 0; i < slotScopeIdList.length; i++) {
          attrs![slotScopeIdList[i]] = ''
        }
      }

      // set current rendering instance for asset resolution
      const prev = setCurrentRenderingInstance(instance) 
      try {
        ssrRender(  //通过ssrRender方法进行渲染
          instance.proxy,
          push,
          instance,
          attrs,
          // compiler-optimized bindings
          instance.props,
          instance.setupState,
          instance.data,
          instance.ctx,
        )
      } finally {
        setCurrentRenderingInstance(prev)
      }
    } else if (instance.render && instance.render !== NOOP) {
      renderVNode(
        push,
        (instance.subTree = renderComponentRoot(instance)),
        instance,
        slotScopeId,
      )
    } else {
      const componentName = comp.name || comp.__file || `<Anonymous>`
      warn(`Component ${componentName} is missing template or render function.`)
      push(`<!---->`)
    }
  }
  return getBuffer()
}


 
export function createBuffer() {
  let appendable = false
  const buffer: SSRBuffer = [] // 定义了闭包
  return {
    getBuffer(): SSRBuffer {
      // Return static buffer and await on items during unroll stage
      return buffer
    },
    push(item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item) // 满足的时候一直push
      }
      appendable = isStringItem
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        // promise, or child buffer with async, mark as async.
        // this allows skipping unnecessary await ticks during unroll stage
        buffer.hasAsync = true
      }
    },
  }
}

```

## unrollBuffer
packages/server-renderer/src/renderToString.ts

1. 传入buffer 数组，依次遍历数组，循环拼接到ret  
```js

async function unrollBuffer(buffer: SSRBuffer): Promise<string> {
  if (buffer.hasAsync) {
    let ret = ''
    for (let i = 0; i < buffer.length; i++) { //遍历所有 buffer数组
      let item = buffer[i]
      if (isPromise(item)) {
        item = await item
      }
      if (isString(item)) {
        ret += item // 把字符串 拼接在一起
      } else {
        ret += await unrollBuffer(item)
      }
    }
    return ret
  } else {
    // sync buffer can be more efficiently unrolled without unnecessary await
    // ticks
    return unrollBufferSync(buffer)
  }
}

function unrollBufferSync(buffer: SSRBuffer): string {
  let ret = ''
  for (let i = 0; i < buffer.length; i++) {
    let item = buffer[i]
    if (isString(item)) {
      ret += item
    } else {
      // since this is a sync buffer, child buffers are never promises
      ret += unrollBufferSync(item as SSRBuffer)
    }
  }
  return ret
}
```


# 同构代码


刚才的例子无法触发事件，需要要实现的就是同构代码的操作

vue的项目结构，router + store + compoment


![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/729b22dcbbda47b790b2cb02c5b3e134~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgamFzb25feWFuZw==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjk3MjcwNDc5NTgwMjY1MyJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1731487427&x-orig-sign=dSaOzwxFwR4FUk9OUiGcIG%2FdRpg%3D)

根据上图，我们通过两个不同的入口文件把包项目
- server-entry 
- client-entry
首次通过server-entry入口文件进行加载资源。在后续点击路由后，使用client-entry结构客户端的渲染


## 缺点
1. 多了个服务要管理
2. 页面变得极其复杂能以维护
3. 大并发时候的性能问题

## 优化方案
1. 降级处理，当请求到达一定峰值，回归CSR模式。
2. 针对不高频变化的页面，提前渲染静态资源 - （Static Site Generation，SSG） 推荐nuxt
3. 当在手机客户端，可以把大数据量渲染交给客户端 - 客户端渲染（Native Side Rendering，NSR）
4. 利用CDN把访问的页面内容，固化成CDN资源 -  增量渲染（Incremental Site Rendering，ISR）
5. 利用CDN支持的Node服务能力进行渲染 -  边缘渲染（Edge Side Rendering，ESR） 
6. 在浏览器上直接运行node webcontainer  https://stackblitz.com/edit/stackblitz-webcontainer-api-starter-d6qydq?file=README.md