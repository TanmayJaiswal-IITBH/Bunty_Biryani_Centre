import { resetSchema } from './reset-schema';
import { resolveTestEnv } from './test-env';

export default async function setup(): Promise<void> {
  await resetSchema(resolveTestEnv().DATABASE_URL as string);
}
