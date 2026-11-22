const CONTACT = 'https://github.com/chessmcp-org/web/issues'

export const PRIVACY_TXT = `chessmcp.org Privacy Policy
Last updated: 22 November 2026

chessmcp.org turns chess games and positions into interactive boards inside
ChatGPT. This policy explains what the service handles. We keep it short
because we keep very little.

1. What we collect

Sign-in. When you sign in with Google, Google tells us your Google account
ID and your email address. We use the ID to create your private link and the
email only to show you which account you are signed in with. We do not
request access to your Google contacts, files, mail or any other Google data.

Chess data. When ChatGPT (or you) sends a game (PGN) or position (FEN) to
the service, we process it in memory to draw the board and send the result
back. We do not store it, log it, or use it for anything else.

Technical logs. Our hosting provider (DigitalOcean) may keep standard server
logs, such as IP addresses and request times, as part of running the service.
Our own application logs only errors, such as a rejected move or a failed
sign-in. It does not record whole games, emails or names.

2. Cookies

We use two cookies, both strictly necessary:
- session: a signed cookie that keeps you signed in (up to 30 days). It
  holds your Google account ID and email. It is not readable by scripts on
  the page.
- oauth_state: a short-lived cookie (10 minutes) that protects the Google
  sign-in step.
We do not use advertising or analytics cookies.

3. What we do not do

We do not have a database. We do not keep accounts, profiles or game
history. We do not sell or share your information, and we do not use it for
advertising.

4. Your private link

Your link (https://chessmcp.org/mcp/...) is generated from your Google
account ID and a server secret, so nothing about it is stored. Anyone who has
the link can use your connector, so keep it private. Signing out ends your
browser session but does not change the link.

5. Third parties

- Google, to sign you in (see Google's privacy policy).
- DigitalOcean, which hosts the service.
- Cloudflare, which manages the domain's DNS.
- OpenAI (ChatGPT), which sends requests to the service when you use the
  connector. What ChatGPT does with your conversation is governed by OpenAI's
  policies, not this one.

6. Your choices

You can sign out at any time and delete the cookies in your browser. Because
we hold no stored data about you, there is nothing further to delete. If you
want your private link to stop working, contact us and we will rotate the
server secret, which also invalidates every other user's link.

7. Children

The service is not directed at children under 13, and we do not knowingly
collect their information.

8. Changes

If this policy changes, we will update the date above.

9. Contact

Questions: ${CONTACT}
`

export const TERMS_TXT = `chessmcp.org Terms of Service
Last updated: 22 November 2026

By using chessmcp.org (the "Service") you agree to these terms. If you do not
agree, do not use it.

1. The Service

chessmcp.org turns chess games (PGN) and positions (FEN) into interactive
boards, mainly inside ChatGPT through an MCP connector. Signing in with
Google gives you a private link you can add to ChatGPT.

2. Your private link

Your private link works like a password. Keep it to yourself. Anyone who has
it can use your connector, and you are responsible for what happens through
it. If you think it has leaked, tell us (see section 9).

3. Acceptable use

Do not use the Service to break the law, attack or overload it, probe it for
weaknesses without permission, send content you have no right to send, or
resell access to it. We may block access that harms the Service or other
users.

4. Your content

You keep your rights to any games or positions you send. We process them only
to draw boards and do not store them (see the Privacy Policy). You are
responsible for the content you send.

5. Our content and licences

The software behind the Service is published at
https://github.com/chessmcp-org/web. Chess pieces are "Staunty" by sadsnake1
(via lichess.org), licensed under CC BY-NC-SA 4.0
(https://creativecommons.org/licenses/by-nc-sa/4.0/). The Service is free and
non-commercial, which is what that licence requires.

6. No warranty

The Service is provided "as is" and "as available", without warranties of any
kind. We do not promise it will be uninterrupted, error-free or fit for a
particular purpose. Boards and analysis shown through ChatGPT may contain
mistakes, including mistakes made by the AI. Do not rely on them for anything
important.

7. Limitation of liability

To the fullest extent the law allows, we are not liable for any indirect,
incidental or consequential damages, or for loss of data or profits, arising
from your use of the Service. The Service is free, and our total liability is
limited to the amount you paid for it, which is zero.

8. Changes and termination

We may change or discontinue the Service, or change these terms, at any time.
If we change the terms, we will update the date above. Continuing to use the
Service after a change means you accept it. You can stop using the Service at
any time.

9. Contact

Questions or reports: ${CONTACT}
`
