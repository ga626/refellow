// 邮件凭据仅由服务端环境提供，不进入网页或扩展包。
export function mailReady(env){return typeof env.MAIL_SEND==='function'||!!(env.MAIL_FROM&&(env.BREVO_API_KEY||env.RESEND_API_KEY));}
export async function sendAccountMail(env,email,code,purpose){
 const subject='参伴 · '+(purpose==='reset'?'重置密码':'邮箱验证');
 const message=`你的验证码是 ${code}，10分钟内有效。请勿向他人提供。若非本人操作，请忽略此邮件。`;
 if(typeof env.MAIL_SEND==='function')return env.MAIL_SEND({email,code,purpose,subject,text:message});
 if(!mailReady(env))throw Object.assign(Error('邮件服务尚未配置，暂不能发送验证码。已有账户仍可登录。'),{status:503});
 const brevo=!!env.BREVO_API_KEY;let response;
 try{response=await fetch(brevo?'https://api.brevo.com/v3/smtp/email':'https://api.resend.com/emails',{method:'POST',headers:brevo?{'api-key':env.BREVO_API_KEY,'Content-Type':'application/json'}:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(brevo?{sender:{name:'参伴',email:env.MAIL_FROM},to:[{email}],subject,textContent:message}:{from:env.MAIL_FROM,to:[email],subject,text:message}),signal:AbortSignal.timeout(15000)});}catch{throw Object.assign(Error('验证码邮件暂时未能发送，请稍后重试。'),{status:502});}
 if(!response.ok)throw Object.assign(Error('验证码邮件暂时未能发送，请稍后重试或联系支持。'),{status:502});
}
