import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error(
    "GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定してください",
  );
}

const redirectUri = "http://localhost:3000/callback";

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost:3000");

  if (url.pathname === "/login") {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "openid email profile",
    });

    response.writeHead(302, {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    });

    response.end();
    return;
  }

  if (url.pathname === "/callback") {
    const error = url.searchParams.get("error");

    if (error) {
      response.writeHead(400, {
        "Content-Type": "text/html; charset=utf-8",
      });

      response.end(`<h1>認可がキャンセルされました: ${error}</h1>`);
      return;
    }

    const code = url.searchParams.get("code");

    if (!code) {
      response.writeHead(400, {
        "Content-Type": "text/html; charset=utf-8",
      });

      response.end("<h1>認可コードがありません</h1>");
      return;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      response.writeHead(500, {
        "Content-Type": "text/html; charset=utf-8",
      });

      response.end("<h1>アクセストークンの取得に失敗しました</h1>");
      return;
    }

    const token = (await tokenResponse.json()) as {
      access_token: string;
    };

    const userResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      },
    );

    if (!userResponse.ok) {
      response.writeHead(500, {
        "Content-Type": "text/html; charset=utf-8",
      });

      response.end("<h1>ユーザー情報の取得に失敗しました</h1>");
      return;
    }

    const user = (await userResponse.json()) as {
      name?: string;
      email?: string;
    };

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });

    response.end(`<h1>こんにちは、${user.name}(${user.email})さん</h1>`);
    return;
  }

  const html = await readFile("index.html", "utf8");

  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
  });

  response.end(html);
});

server.listen(3000, () => {
  console.log("http://localhost:3000 で起動しました");
});
