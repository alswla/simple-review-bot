export function info(message: string): void {
  console.log(`ℹ️  ${message}`);
}

export function success(message: string): void {
  console.log(`✅ ${message}`);
}

export function warn(message: string): void {
  console.log(`⚠️  ${message}`);
}

export function error(message: string): void {
  console.error(`❌ ${message}`);
}

export function debug(message: string): void {
  if (process.env.RUNNER_DEBUG === "1") {
    console.log(`🐛 ${message}`);
  }
}

export function agent(agentName: string, emoji: string, message: string): void {
  console.log(`${emoji} [${agentName}] ${message}`);
}
