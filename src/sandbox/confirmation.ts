import readline from "node:readline";

export type ConfirmationGate = (
  resolvedPath: string,
  operation: "write" | "edit",
  params: any,
) => Promise<boolean>;

export function createCliConfirmationGate(): ConfirmationGate {
  return async (resolvedPath, operation, params) => {
    console.log(`\n  Agent wants to ${operation}: ${resolvedPath}`);

    // Show preview of content if available
    const content = params?.content ?? params?.path;
    if (typeof content === "string" && content.length > 0 && content !== resolvedPath) {
      const preview = content.length > 300 ? content.substring(0, 300) + "..." : content;
      console.log(`  Preview:\n    ${preview.split("\n").join("\n    ")}`);
    }

    const answer = await promptUser("  [A]pprove / [D]eny: ");
    return answer.toLowerCase().startsWith("a");
  };
}

function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
