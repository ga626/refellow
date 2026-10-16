// 网站栏目配方是采集提示，不是许可或接口已接通的声明。事实来自2026-10-10逐站初审。
const rules=[
 ['react-bits',/(^|\.)reactbits\.dev$/, /\/(backgrounds|text-animations|animations|components)\//,'效果详情','React / CSS','先截Preview或录一段；把实际调过的参数、Code页入口和Copy for AI原文附在同一参考。'],
 ['react-bits',/(^|\.)reactbits\.dev$/, /mcp/,'MCP文档','React','只记录官方配置入口；收藏接口网址不等于安装、授权或调用成功。'],
 ['landbook',/(^|\.)land-book\.com$/, /motion/i,'Motion栏目','视觉参考','录制你看中的节奏，记录具体条目及原站。'],
 ['one-page-love',/(^|\.)onepagelove\.com$/, /templates/i,'模板栏目','按条目说明','附模板详情和许可入口；不要把预览等同可自由使用的源码。'],
 ['awwwards',/(^|\.)awwwards\.com$/, /elements|collections|academy/i,'混合栏目','按条目说明','先确定你看中的是网站、元素还是课程；保存实际条目而非只留栏目首页。'],
 ['siteinspire',/(^|\.)siteinspire\.com$/, /.*/,'网站参考','视觉参考','打开你喜欢的真实网站：截图或短录制，保存原网址；发现入口可另记。'],
 ['httpster',/(^|\.)httpster\.net$/, /.*/,'网站参考','视觉参考','保留原站的完整风格，先采画面和地址，分类命名回收藏夹再做。'],
 ['one-page-love',/(^|\.)onepagelove\.com$/, /.*/,'网站参考','视觉参考','跳到真实作品再采集，原网址与发现条目分别保存。'],
 ['awwwards',/(^|\.)awwwards\.com$/, /.*/,'网站与精选','视觉参考','整站案例先保留完整画面和原网址；目录首页本身不是已选案例。'],
 ['recent',/(^|\.)(godly\.website|recent\.design)$/, /.*/,'网站 / Motion / 字体','按栏目判断','按当前条目附画面；网站记原站，字体或品牌条目补名称与出处。'],
 ['landbook',/(^|\.)land-book\.com$/, /.*/,'网站 / Sections / 模板','按栏目判断','具体条目优先；整站记原站，Section可在截图中标出借鉴区域。'],
 ['lapa',/(^|\.)lapa\.ninja$/, /.*/,'截图 / 视频 / 版本','视觉参考','保留所看版本和原页面；不能把历史截图当作原站现在的效果。'],
 ['mobbin',/(^|\.)mobbin\.com$/, /.*/,'产品屏幕与流程','视觉参考','保存屏幕 / 流程条目、产品名及步骤说明；不假设能访问真实原应用。'],
 ['refero',/(^|\.)refero\.design$/, /.*/,'产品屏幕与风格','视觉参考','按当前屏幕采画面；可连续附多张截图，不必强制先选流程分类。'],
 ['saasframe',/(^|\.)saasframe\.io$/, /.*/,'产品 / 屏幕 / 模板','按条目说明','把具体条目与真实产品分开记录，模板另附官方实现与许可入口。'],
 ['60fps',/(^|\.)60fps\.design$/, /.*/,'Shots / Motion / Snippets','部分代码为 SwiftUI','短录制呈现节奏；若附Snippet请注明SwiftUI，不能直接当作React组件。MCP未实测。'],
 ['threeui',/(^|\.)threeui\.com$/, /.*/,'页面 / 3D / 背景','Three.js等，按条目','录制背景或3D互动，补条目和参数；MCP入口只作链接，未验证调用。'],
 ['21st',/(^|\.)21st\.dev$/, /.*/,'组件 / 模板 / 主题','React等，按条目','保存预览及组件入口；若有原prompt，手动复制为原提示词附件，权益按账号确认。'],
 ['shadcn',/(^|\.)ui\.shadcn\.com$/, /.*/,'组件与Registry','React','截图说明想要的样子，另附官方源码 / Registry / MCP入口；代码不在收藏器内执行。'],
 ['fonts-in-use',/(^|\.)fontsinuse\.com$/, /.*/,'字体案例','排版参考','附案例截图、字体名称与字体厂商入口；截图不提供字体商用许可。'],
 ['typewolf',/(^|\.)typewolf\.com$/, /.*/,'字体搭配','排版参考','保存字体名、配对及来源，字体授权单独确认。'],
 ['inspoai',/(^|\.)inspoai\.(com|io)$/, /.*/,'未充分核验','通用回退','目前条目接口与复制能力证据不足，仅按通用截图 / 录制 / 网址采集。']
];
export function recipeFor(value){
  let url;try{url=new URL(value);}catch{return generic();}
  const found=rules.find(([,host,path])=>host.test(url.hostname.toLowerCase())&&path.test(url.pathname));
  if(!found)return generic();const [id,,,section,environment,hint]=found;return {id,section,environment,hint,verifiedAt:'2026-10-10',status:id==='inspoai'?'limited':'source-reviewed'};
}
function generic(){return {id:'generic',section:'普通网页',environment:'待确认',hint:'先收藏画面和具体网址。需要实现资料时，回收藏夹附原提示词、参数或官方代码入口。',status:'generic'};}
export function reviewedRecipes(){return [...new Set(rules.map(r=>r[0]))];}
