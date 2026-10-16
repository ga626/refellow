// 仅测试注入邮件接收器，不访问真实发件服务。
export async function registerVerified(call,env,{username,email,password,displayName}){
 email=(email||username).trim().toLowerCase();if(!email.includes('@'))email+='@example.test';
 let message;env.MAIL_SEND=async mail=>{message=mail;};
 const sent=await call('/email/code',{method:'POST',body:JSON.stringify({email,purpose:'register'})});if(!sent.ok)throw Error(await sent.text());
 return call('/register',{method:'POST',body:JSON.stringify({email,password,displayName,code:message.code})});
}
