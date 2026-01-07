/**
 * WeCom 会话内容存档（方案 B：纯 HTTP，不用 wework-chat-node）
 * 目的：
 * 1. 验证 corpId / corpSecret 是否正确
 * 2. 验证 msgaudit 接口是否已在企业微信后台开启
 * 3. 返回清晰错误，而不是 dyld / bindings 崩溃
 */

const BASE = "https://qyapi.weixin.qq.com/cgi-bin";

/** 读取必须的环境变量 */
function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

/** 获取 access_token */
export async function wecomGetAccessToken() {
  const corpId = mustEnv("WECOM_CORP_ID");
  const corpSecret = mustEnv("WECOM_CORP_SECRET");

  const url =
    `${BASE}/gettoken?corpid=${encodeURIComponent(corpId)}` +
    `&corpsecret=${encodeURIComponent(corpSecret)}`;

  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();

  if (!r.ok) {
    throw new Error(`gettoken http ${r.status}: ${text}`);
  }

  const j = JSON.parse(text);
  if (j.errcode !== 0) {
    throw new Error(`gettoken failed: ${j.errcode} ${j.errmsg}`);
  }

  return j.access_token as string;
}

/**
 * 拉取会话内容（不会解密，只验证接口是否可用）
 * 企业微信：/cgi-bin/msgaudit/getchatdata
 */
export async function wecomPullChatData(opts: {
  seq: number;
  limit: number;
  timeout: number;
}) {
  const token = await wecomGetAccessToken();

  const url = `${BASE}/msgaudit/getchatdata?access_token=${token}`;

  const body = {
    seq: opts.seq ?? 0,
    limit: opts.limit ?? 1,
    timeout: opts.timeout ?? 1,
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await r.text();

  if (!r.ok) {
    throw new Error(
      `getchatdata http ${r.status} url=${url}: ${text || "<empty>"}`
    );
  }

  // ⚠️ 重点：企业微信在「未开启会话内容存档」时，会返回合法 HTTP，但内容是空 / errcode
  if (!text) {
    throw new Error("getchatdata returned empty body");
  }

  return JSON.parse(text);
}
