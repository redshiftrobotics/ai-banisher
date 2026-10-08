import * as vscode from "vscode";

const AI_SETTING = "chat.disableAIFeatures";
const EXT_SETTING = "extensions.allowed";
const BLOCKED_CATEGORIES = ["ai", "chat", "machine learning"];
const AI_KEYWORDS = [
	"AI", "Claude", "Anthropic", "Gemini", "ChatGPT", "GPT", "OpenAI", "Ollama",
	"LLM", "LLMs", "Copilot", "Codex", "DeepSeek", "Llama", "Mistral", "Qwen",
	"Kimi", "Tabnine", "Codeium"
];
const AI_KEYWORD_PATTERN = new RegExp(
	`\\b(?:${AI_KEYWORDS.map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
	"i"
);

//Disables all built-in editor AI features
async function enforceAIPolicy(): Promise<void> {
	//Ensure AI isn't already disabled
	const configuration = vscode.workspace.getConfiguration();
	if (configuration.get<boolean>(AI_SETTING) !== false) {
		return;
	}

	//Show warning
	vscode.window.showInformationMessage("AI features are not allowed and have been automatically disabled.");

	//Forcibly disable AI again
	await configuration.update(
		AI_SETTING,
		true,
		vscode.ConfigurationTarget.Global
	);
}

//Directly blocks the installation of some popular AI extensions
async function enforceExtensionPolicy(): Promise<void> {
	const config = vscode.workspace.getConfiguration();

	const existing =
		config.get<Record<string, boolean>>("extensions.allowed") ?? {};

	const policy: Record<string, boolean> = {
		...existing,
		"*": true,
		"saasquatch8032.ai-banisher": true,
		"anthropic.claude-code": false,
		"github.copilot": false,
		"github.copilot-chat": false,
		"danielsanmedium.dscodegpt": false,
		"Continue.continue": false,
		"genieai.chatgpt-vscode": false,
		"Alibaba-Cloud.tongyi-lingma": false,
		"kilocode.kilo-code": false,
		"YaleHuang.chatgpt-ai": false,
		"andrepimenta.claude-code-chat": false,
		"codeflow-studio.claude-code-extension": false,
		"sixth.sixth-ai": false,
		"yuanzhixiang.claude-code-yolo": false,
		"kodu-ai.claude-dev-experimental": false,
		"heisebaiyun.kiro-for-cc": false,
		"asadbinimtiaz.kiro-vscode-extension": false,
		"vscjava.migrate-java-to-azure": false,
		"ms-CopilotStudio.vscode-copilotstudio": false,
		"Vizards.deepseek-v4-for-copilot": false,
		"Kingleo.kimi-vscode": false,
		"moonshot-ai.kimi-code": false,
		"Kingleo.deepseek-web": false,
		"doublebot.doublebot": false,
		"DavidDai.deepseek-code-generator": false,
		"openai.chatgpt": false,
		"MohammedAbdulRaffay.code-completer": false,
		"Google.geminicodeassist": false,
		"Google.gemini-cli-vscode-ide-companion": false
	};

	await config.update(
		"extensions.allowed",
		policy,
		vscode.ConfigurationTarget.Global
	);
}

//Extension remover state for re-entrancy
let scanning = false;
const failedUninstalls = new Set<string>();

//Checks if an extension falls into one of the blocked categories
function hasBlockedCategory(extension: vscode.Extension<unknown>): boolean {
	const categories: unknown = extension.packageJSON?.categories;
	if (!Array.isArray(categories)) {
		return false;
	}
	return categories.some(
		category => typeof category === "string" && BLOCKED_CATEGORIES.includes(category.trim().toLowerCase())
	);
}

//Checks if an extension is in the "Other" category or no category
function isUncategorized(extension: vscode.Extension<unknown>): boolean {
	const categories: unknown = extension.packageJSON?.categories;
	if (!Array.isArray(categories)) {
		return true;
	}
	return categories
		.filter((category): category is string => typeof category === "string")
		.map(category => category.trim().toLowerCase())
		.filter(category => category.length > 0)
		.every(category => category === "other");
}

//Checks if an extension's title or description contains AI keywords
function hasAIKeywords(extension: vscode.Extension<unknown>): boolean {
	const pkg = extension.packageJSON;
	const text = [pkg?.displayName ?? pkg?.name, pkg?.description]
		.filter((value): value is string => typeof value === "string")
		.join("\n");
	return AI_KEYWORD_PATTERN.test(text);
}

//Checks if an extension should be banished
function isEvil(extension: vscode.Extension<unknown>): boolean {
	return hasBlockedCategory(extension) ||
		(isUncategorized(extension) && hasAIKeywords(extension));
}

//Removes any extensions that fall under the blocked categories (excluding self) or are uncategorized and contain AI keywords
async function banishEvilExtensions(selfId: string): Promise<void> {
	//Re-entrancy check
	if (scanning) {
		return;
	}
	scanning = true;

	try {
		//Find evil extensions
		const offenders = vscode.extensions.all.filter(extension =>
			extension.id.toLowerCase() !== selfId.toLowerCase() &&
			!failedUninstalls.has(extension.id.toLowerCase()) &&
			isEvil(extension)
		);

		//Try to remove them
		const removed: string[] = [];
		for (const extension of offenders) {
			try {
				//Workbench commands ftw since we don't have a direct API for this
				await vscode.commands.executeCommand("workbench.extensions.uninstallExtension", extension.id);
				removed.push(extension.id);
			} catch {
				//Not worth retrying because I don't want to brick the editor
				failedUninstalls.add(extension.id.toLowerCase());
			}
		}

		//Reload window if we removed anything to ensure clean extension state
		if (removed.length > 0) {
			vscode.window.showInformationMessage("AI extensions are not allowed and have been removed.");
			setTimeout(() => vscode.commands.executeCommand("workbench.action.reloadWindow"), 5000);
		}
	} finally {
		scanning = false;
	}
}

export function activate(context: vscode.ExtensionContext): void {
	//Enforce on start
	enforceAIPolicy();
	enforceExtensionPolicy();
	banishEvilExtensions(context.extension.id);

	//Enforce it again whenever the setting changes.
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(AI_SETTING)) {
				enforceAIPolicy();
			}
			if (event.affectsConfiguration(EXT_SETTING)) {
				enforceExtensionPolicy();
			}
		}),
		vscode.extensions.onDidChange(() => {
			banishEvilExtensions(context.extension.id);
		})
	);
}

export function deactivate(): void {
}