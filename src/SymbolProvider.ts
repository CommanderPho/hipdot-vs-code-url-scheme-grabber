import * as vscode from 'vscode';


export class SymbolTreeItem extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private readonly detail: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.label}-${this.detail}`;
		this.description = this.detail;
	}

	// iconPath = {
	// 	light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
	// 	dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	// };
	contextValue = 'symbol';
}

export class SymbolProvider implements vscode.TreeDataProvider<SymbolTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SymbolTreeItem | undefined | null | void> = new vscode.EventEmitter<SymbolTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<SymbolTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private symbols: vscode.DocumentSymbol[];

	constructor(symbols: vscode.DocumentSymbol[]) {
		this.symbols = symbols;
	}

	refresh(symbols: vscode.DocumentSymbol[]) {
		this.symbols = symbols;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: SymbolTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: SymbolTreeItem): Thenable<SymbolTreeItem[]> {
		if (!this.symbols) {
			vscode.window.showInformationMessage('No symbols!');
			return Promise.resolve([]);
		}
		if (element === undefined) {
			// return this.data;
			return Promise.resolve(this.symbolsToTreeItems(this.symbols));
		}
		else {
			let matchingSymbol = this.findSymbol(this.symbols, element.label!);
			if (matchingSymbol) {
				return Promise.resolve(this.symbolsToTreeItems(matchingSymbol.children));
			}
			else {
				return Promise.resolve(this.symbolsToTreeItems([]));
				// return Promise.resolve([]);
			}
		}
	}


	private symbolsToTreeItems(symbols: vscode.DocumentSymbol[]): SymbolTreeItem[] {
		// `${symbol.name} Range: l(${symbol.range.start.line + 1}) - l(${symbol.range.end.line + 1}), Kind: ${vscode.SymbolKind[symbol.kind]}`
		return symbols.map(symbol =>
			// new SymbolTreeItem(`${symbol.name} Range: l(${symbol.range.start.line + 1}) - l(${symbol.range.end.line + 1}), Kind: ${vscode.SymbolKind[symbol.kind]}`, 
			// symbol.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)
			new SymbolTreeItem(`${symbol.name} Range: l(${symbol.range.start.line + 1}) - l(${symbol.range.end.line + 1})`,
				`Kind: ${vscode.SymbolKind[symbol.kind]}`,
				symbol.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)
		);
	}

	private findSymbol(symbols: vscode.DocumentSymbol[], label: string): vscode.DocumentSymbol | undefined {
		for (const symbol of symbols) {
			if ((`${symbol.name} Range: l(${symbol.range.start.line + 1}) - l(${symbol.range.end.line + 1})`) === label) {
				// if (symbol.name === label) {
				return symbol;
			}
			const found = this.findSymbol(symbol.children, label);
			if (found) {
				return found;
			}
		}
	}
}

