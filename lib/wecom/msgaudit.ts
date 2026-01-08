// lib/wecom/msgaudit.ts

type WeWorkChatNodeModule = any;

let _wework: WeWorkChatNodeModule | null = null;

function getWework(): WeWorkChatNodeModule {
  if (_wework) return _wework;

  // ✅ 关键：用 eval("require") 避免 Next/Turbopack 静态分析并内联到 .next
  const req = (eval("require") as any) as (id: string) => any;
  const mod = req("wework-chat-node");

  _wework = mod?.default ?? mod;
  return _wework;
}

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

/**
 * 拉取会话存档（wework-chat-node 原生 SDK）
 */
export async function wecomPullChatData(params: {
  seq: number;
  limit: number;
  timeout: number;
}) {
  const wework = getWework();

  const corpId = mustEnv("WECOM_CORP_ID");
  const secret = mustEnv("WECOM_MSG_ARCHIVE_SECRET");

  // wework-chat-node 的构造形态：new wework.getChatData({ corpId, secret })
  const sdk = new wework.getChatData({ corpId, secret });

  return await new Promise<any>((resolve, reject) => {
    sdk.getChatData(params.seq, params.limit, params.timeout, (err: any, data: any) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

/**
 * 解密单条消息（wework-chat-node 原生 SDK）
 */
export function decryptChatDataItem(item: any, privateKeyPem: string) {
  const wework = getWework();
  const sdk = new wework.decryptData({ privateKey: privateKeyPem });

  // item.encrypt_random_key / item.encrypt_chat_msg 来自 getchatdata 返回
  return sdk.decryptData(item.encrypt_random_key, item.encrypt_chat_msg);
}
