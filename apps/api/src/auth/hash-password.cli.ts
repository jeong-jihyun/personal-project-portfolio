/** `pnpm --filter @ppp/api hash-password "<비밀번호>"` — ADMIN_PASSWORD_HASH 값을 출력한다. */
import { hashPassword } from './password.js';

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('10자 이상의 비밀번호를 인자로 주세요.');
  process.exit(1);
}
console.log(await hashPassword(password));
