// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { basename } from 'path';
import { getRelatedDefinedSymbols } from './utils/getRelatedDefinedSymbols';
import { getCurrentFileDottedPath } from './utils/getCurrentFileDottedPath';
import { SymbolProvider } from './SymbolProvider';

class NoWorkspaceOpen extends Error {
}

class NoTextEditorOpen extends Error {
}

class DocumentIsUntitled extends Error {
}


// Create output channel
let output_channel = vscode.window.createOutputChannel("hipdot-vs-code");


function getSelectedText() {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		const document = editor.document;
		const selection = editor.selection;
		const text = document.getText(selection);
		return text;
	}
	return '';
}

async function getContainingSymbol(lineNumber: number, symbols: vscode.DocumentSymbol[], full_symbol_path: boolean): Promise<vscode.DocumentSymbol[] | vscode.DocumentSymbol | undefined> {
	// gets the containing symbol Symbol at line 52: Function safe_find_index_in_list
	// currentFileDottedPath: src.pyphocorehelpers.indexing_helpers

	let result: vscode.DocumentSymbol[] = [];
	for (let symbol of symbols) {
		if (symbol.range.start.line <= lineNumber && symbol.range.end.line >= lineNumber) {

			if (full_symbol_path) {
				// Prepare for returning the symbol
				result.push(symbol);
			}

			if (symbol.children) {
				let foundSymbol = await getContainingSymbol(lineNumber, symbol.children, full_symbol_path);

				if (foundSymbol) {
					if (full_symbol_path) {
						// Attach the chain of child symbols to the result
						result = result.concat(foundSymbol as vscode.DocumentSymbol[]);
					}
					else {
						// If a matching child symbol is found, return that instead of the parent
						return foundSymbol;
					}
				}
			}

			if (full_symbol_path && result.length > 0) {
				// If full_symbol_path flag is set and result array is not empty, then return the result.
				return result;
			}
			else if (!full_symbol_path) {
				// If full_symbol_path flag is not set and there are no children, then return the symbol.
				return symbol;
			}
		}
	}
	// If no matching symbol is found, return undefined.
	return undefined;
}



async function copyCurrentLanguageServerSymbols() {
	// copies the current symbol using the language server

	if (!vscode.workspace.rootPath) {
		throw new Error("NoWorkspaceOpen");
	}

	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		throw new Error("NoTextEditorOpen");
	}

	let document = editor.document;
	if (document.isUntitled) {
		throw new Error("DocumentIsUntitled");
	}

	// const path = document.uri.path;

	const lineNumber = editor.selection.active.line;
	let symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
		'vscode.executeDocumentSymbolProvider',
		document.uri
	);

	let res: string[] = [];
	if (symbols) {
		res.push("All symbols:");
		console.log("All symbols:");
		output_channel.appendLine("All symbols:");

		// await printAllSymbols(symbols, res);
		// let symbol = await getContainingSymbol(lineNumber, symbols, res);
		await printAllSymbols(symbols);

		for (let symbol of symbols) {
			console.log(`Symbol name: ${symbol.name}, Range: l(${symbol.range.start.line}, ${symbol.range.start.character}) - l(${symbol.range.end.line}, ${symbol.range.end.character}), Kind: ${vscode.SymbolKind[symbol.kind]}`);
			output_channel.appendLine(`Symbol name: ${symbol.name}, Range: l(${symbol.range.start.line}, ${symbol.range.start.character}) - l(${symbol.range.end.line}, ${symbol.range.end.character}), Kind: ${vscode.SymbolKind[symbol.kind]}`);

			if (symbol.children) {
				await printAllSymbols(symbol.children);
			}
		}

		// const symbolProvider = new SymbolProvider(symbols);

		// Get best symbol
		let symbol = await getContainingSymbol(lineNumber, symbols, false); // full_symbol_path = True
		if (symbol) {
			let lineSymbolText = `Symbol at line ${lineNumber}: ${vscode.SymbolKind[symbol.kind]} ${symbol.name}`;
			console.log(lineSymbolText);
			output_channel.appendLine(lineSymbolText);
			res.push(`\n${lineSymbolText}`);

			// get best symbol
			// get current file dotted path
			// const currentFileDottedPath = getCurrentFileDottedPath({ rootPath: folder.uri.fsPath, currentFilePath: currentFilePath, shouldAddModuleRootName});
			try {
				const resource = editor.document.uri;
				if (resource.scheme === 'file') {
					const currentFilePath = editor.document.fileName;
					if (!currentFilePath) {
						vscode.window.showErrorMessage("Don't read file. only use this command when selected file.");
						return;
					}
					if (!/.py$/.test(currentFilePath)) {
						vscode.window.showErrorMessage('Not a python file. only use this command when selected python file.');
						return;
					}
					// Get workspace folder to determine relative path
					const folder = vscode.workspace.getWorkspaceFolder(resource);
					if (!folder) {
						vscode.window.showErrorMessage('No workspace folder is opened. only use this command in a workspace.');
						return;
					}
					// get current file dotted path
					const currentFileDottedPath = getCurrentFileDottedPath({ rootPath: folder.uri.fsPath, currentFilePath: currentFilePath, shouldAddModuleRootName: false });
					output_channel.appendLine(`currentFileDottedPath: ${currentFileDottedPath}`);
					// get related defined symbols from current file and current cursor position
					const text = vscode.window.activeTextEditor!.document.getText();
					const currentLine = vscode.window.activeTextEditor!.selection.active.line;
					const definedSymbols = getRelatedDefinedSymbols(text, currentLine + 1);
					const finalOutPath = [currentFileDottedPath, ...definedSymbols].join('.');
					// copy python dotted path to clipboard
					await vscode.env.clipboard.writeText(finalOutPath);
					// vscode.window.showInformationMessage('Copied to clipboard.');
					vscode.window.showInformationMessage(['Copied to clipboard', finalOutPath].join(': '));

				} else {
					output_channel.appendLine("could not get currentFileDottedPath.");
				}
			} catch (e) {
				console.error(e);
				vscode.window.showErrorMessage('Failed to parse file.');
			}

		}
		else {
			res.push(`\nNo symbol at line ${lineNumber}`);
			console.log(`No symbol at line ${lineNumber}`);
		}
	} else {
		res.push("No symbols found");
	}
	return res.join("");
};



function copyCurrentFilePathWithCurrentLineNumber(markdown: boolean = false, includeHighlightedTextAsCodeBlock: boolean = false, includeContainingSymbolPath: boolean = false): string {
	// Copies the current file filesystem path with the line number
	// [/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoCoreHelpers/src/pyphocorehelpers/indexing_helpers.py:53](vscode://file/c:/Users/pho/repos/Spike3DWorkEnv/pyPhoCoreHelpers/src/pyphocorehelpers/indexing_helpers.py:53)
	if (!vscode.workspace.rootPath) {
		throw new NoWorkspaceOpen;
	}

	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		throw new NoTextEditorOpen;
	}

	let document = editor.document;
	if (document.isUntitled) {
		throw new DocumentIsUntitled;
	}

	const path = document.uri.path;
	const relativePath = path.replace(vscode.workspace.rootPath, '');
	const lineNumber = editor.selection.active.line + 1;
	const columnNumber = editor.selection.active.character + 1;
	const includeColumn = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber').get('includeColumn');

	const url = `vscode://file${path}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}`;
	// return markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
	let output = markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;

	if (includeHighlightedTextAsCodeBlock) {
		const selectedText = editor.document.getText(editor.selection);
		const codeBlock = "```" + document.languageId + "\n" + selectedText + "\n```";
		// TODO: optionally de-indent to the appropriate (minimum) level
		output += "\n" + codeBlock;
	}

	return output;
};


async function printAllSymbols(symbols: vscode.DocumentSymbol[]) {
	for (let symbol of symbols) {
		let lineSymbolText = `Symbol name: ${symbol.name}, Range: l(${symbol.range.start.line}, ${symbol.range.start.character}) - l(${symbol.range.end.line}, ${symbol.range.end.character}), Kind: ${vscode.SymbolKind[symbol.kind]}`;
		console.log(lineSymbolText);
		output_channel.appendLine(lineSymbolText);
		if (symbol.children) {
			await printAllSymbols(symbol.children);
		}
	}
}

// async function getContainingSymbol(lineNumber: number, symbols: vscode.DocumentSymbol[]): Promise<vscode.DocumentSymbol | undefined> {
// 	// Doesn't quite work, seems to get the outer-most symbol and not the innermost one that contains the lines.
//     for (let symbol of symbols) {
//         if (symbol.range.start.line <= lineNumber && symbol.range.end.line >= lineNumber) {
//             return symbol;
//         } else if (symbol.children) {
//             let foundSymbol = await getContainingSymbol(lineNumber, symbol.children);
//             if (foundSymbol)
//                 return foundSymbol;
//         }
//     }
//     return undefined;
// }



// function copyCurrentLanguageServerSymbols(): string {
// 	if (!vscode.workspace.rootPath) {
// 		throw new NoWorkspaceOpen;
// 	}

// 	let editor = vscode.window.activeTextEditor;
// 	if (!editor) {
// 		throw new NoTextEditorOpen;
// 	}

// 	let document = editor.document;
// 	if (document.isUntitled) {
// 		throw new DocumentIsUntitled;
// 	}

// 	const path = document.uri.path;
// 	const relativePath = path.replace(vscode.workspace.rootPath, '');
// 	const lineNumber = editor.selection.active.line + 1;
// 	const columnNumber = editor.selection.active.character + 1;
// 	const includeColumn = vscode.workspace.getConfiguration('hipdotUrlSchemeGrabber').get('includeColumn');
// 	const url = `vscode://file${path}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}`;


// 	// assuming you have a vscode.TextDocument `doc`
// 	let symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
// 	'vscode.executeDocumentSymbolProvider',
// 	document.uri
// 	);

// 	// TODO: print all of the symbols to the debug console

// 	// TODO: find which symbols correspond to the current lineNumber

// 	// // return markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;
//     // let output = markdown ? `[${relativePath}:${lineNumber}${includeColumn ? `:${columnNumber}` : ''}](${url})` : url;

//     // if (includeHighlightedTextAsCodeBlock) {
//     //     const selectedText = editor.document.getText(editor.selection);
//     //     const codeBlock = "```" + document.languageId + "\n" + selectedText + "\n```";
// 	// 	// TODO: optionally de-indent to the appropriate (minimum) level
//     //     output += "\n" + codeBlock;
//     // }

//     // return output;
// };



// the symbols array now contains the symbol tree for the document
// you have to traverse this tree to find the corresponding symbol



// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Create output channel
	// let output_channel = vscode.window.createOutputChannel("hipdot-vs-code", "python")

	// write to output
	output_channel.appendLine('Congratulations, your extension "hipdot-vs-code-url-scheme-grabber" is now active!');


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hipdot-vs-code-url-scheme-grabber" is now active!');

	let copyRawLink = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyLink', () => {
		let filePathWithLineNumber;
		try {
			filePathWithLineNumber = copyCurrentFilePathWithCurrentLineNumber();
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumber) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumber).then(() => {
			vscode.window.showInformationMessage('URL Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyRawLink);

	let copyMarkdownLink = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyMarkdownLink', () => {
		let filePathWithLineNumber;
		try {
			filePathWithLineNumber = copyCurrentFilePathWithCurrentLineNumber(true, false, true);
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumber) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumber).then(() => {
			vscode.window.showInformationMessage('Markdown URL Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyMarkdownLink);

	let copyLinkAndSelection = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyLinkAndSelection', () => {
		let filePathWithLineNumberAndCode;
		try {
			filePathWithLineNumberAndCode = copyCurrentFilePathWithCurrentLineNumber(false, true, true);
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumberAndCode) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumberAndCode).then(() => {
			vscode.window.showInformationMessage('URL+Selection Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyLinkAndSelection);


	let copyMarkdownLinkAndSelection = vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyMarkdownLinkAndSelection', () => {
		let filePathWithLineNumberAndCode;
		try {
			filePathWithLineNumberAndCode = copyCurrentFilePathWithCurrentLineNumber(true, true, true);
		} catch (e) {
			if (e instanceof NoWorkspaceOpen) {
			} else if (e instanceof NoTextEditorOpen) {
			} else if (e instanceof DocumentIsUntitled) {
			} else {
				throw e;
			}
		}

		if (!filePathWithLineNumberAndCode) {
			throw new Error("Could not get file path with line number.");
		}

		vscode.env.clipboard.writeText(filePathWithLineNumberAndCode).then(() => {
			vscode.window.showInformationMessage('Markdown URL+Selection Copied to Clipboard');
		});
	});

	context.subscriptions.push(copyMarkdownLinkAndSelection);

	// new LSP thing:
	// context.subscriptions.push(
	//     vscode.commands.registerCommand('hipdot-vs-code-url-scheme-grabber.copyCurrentLanguageServerSymbols', copyCurrentLanguageServerSymbols)
	// );

	let copyCurrentLanguageServerSymbolsCommand = vscode.commands.registerCommand(
		'hipdot-vs-code-url-scheme-grabber.copyCurrentLanguageServerSymbols', async () => {
			let symbolInfo;
			try {
				symbolInfo = await copyCurrentLanguageServerSymbols();
			} catch (e) {
				if (e instanceof NoWorkspaceOpen) {
				} else if (e instanceof NoTextEditorOpen) {
				} else if (e instanceof DocumentIsUntitled) {
				} else {
					throw e;
				}
			}

			if (!symbolInfo) {
				throw new Error("Could not get symbol info.");
			}

			vscode.env.clipboard.writeText(symbolInfo).then(() => {
				vscode.window.showInformationMessage('Python Symbol Information Copied to Clipboard');
			});
		});
	context.subscriptions.push(copyCurrentLanguageServerSymbolsCommand);


	// WEBVIEW API:
	// let disposable = vscode.commands.registerCommand('extension.showSymbols', async () => {
	// 	// Create and show a new webview panel
	// 	const panel = vscode.window.createWebviewPanel(
	// 		'symbolView', // Identifies the type of the webview. Used internally
	// 		'Current Symbols', // Title of the panel displayed to the user
	// 		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
	// 		{} // Webview options
	// 	);

	// 	// Get symbols
	// 	const editor = vscode.window.activeTextEditor;
	// 	if (!editor || editor.document.languageId !== 'python') {
	// 		panel.webview.html = `<h1>No symbols here</h1>`;
	// 		return;
	// 	}

	// 	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
	// 		'vscode.executeDocumentSymbolProvider',
	// 		editor.document.uri
	// 	);

	// 	if (!symbols || !symbols.length) {
	// 		panel.webview.html = `<h1>No symbols here</h1>`;
	// 		return;
	// 	}

	// 	// Display symbols in webview
	// 	const symbolsHtml = symbols.map(symbol => `
	// 		<div>
	// 			<h2>${symbol.name}</h2>
	// 			<p>Type: ${vscode.SymbolKind[symbol.kind]}</p>
	// 			<p>Range: ${symbol.range.start.line} - ${symbol.range.end.line}</p>
	// 		</div>
	// 	`).join('\n');

	// 	panel.webview.html = `<body>${symbolsHtml}</body>`;
	// });
	// context.subscriptions.push(disposable);

	// TreeView API:
	let disposable = vscode.commands.registerCommand('extension.showSymbols', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document.languageId !== 'python') {
			vscode.window.showInformationMessage('No symbols here');
			return;
		}

		const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
			'vscode.executeDocumentSymbolProvider',
			editor.document.uri
		);

		if (!symbols || !symbols.length) {
			vscode.window.showInformationMessage('No symbols here');
			return;
		}

		const symbolProvider = new SymbolProvider(symbols);

		vscode.window.createTreeView('symbolView', { treeDataProvider: symbolProvider });
	});
	context.subscriptions.push(disposable);

	output_channel.show()

}

// This method is called when your extension is deactivated
export function deactivate() { }
