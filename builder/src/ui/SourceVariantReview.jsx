export function SourceVariantCounts({ counts }) {
	if (!counts) return null;
	if (Object.hasOwn(counts, "existingFolderAdditionCount")) {
		const sources = `${counts.sourceCount} source${counts.sourceCount === 1 ? "" : "s"}`;
		const newFolders = `${counts.folderCount} new folder${counts.folderCount === 1 ? "" : "s"}`;
		const existingFolders = `${counts.existingFolderAdditionCount} existing folder${counts.existingFolderAdditionCount === 1 ? "" : "s"}`;
		const summary = counts.sourceCount === 0 ? counts.unresolvedEntityCount > 0 ? "New sources need a destination." : "No new sources to add."
			: counts.folderCount === 0 ? `${sources} to add to ${existingFolders}.`
				: counts.existingFolderAdditionCount === 0 ? `${newFolders} with ${sources}.`
					: `${sources} to add across ${newFolders} and ${existingFolders}.`;
		return <p className="editor-field-help" data-source-variant-counts="true">{summary}</p>;
	}
	return <div className="editor-field-help" role="status" data-source-variant-counts="true">
		<p>{counts.configured} configured · {counts.existing} already present · {counts.omitted} omitted · {counts.toAdd} to add</p>
	</div>;
}

export function SourceVariantReview({ drafts, review, variantKey }) {
	const existing = new Set(review.destination.map((entry) => entry.identity));
	const elsewhere = new Set(review.elsewhere.map((entry) => entry.identity));
	return <>
		<SourceVariantCounts counts={review.counts} />
		<ul className="genre-review-list" aria-label="Configured sources">
			{drafts.map((draft) => {
				const key = variantKey(draft);
				return <li key={key}><strong>{draft.editable.title}</strong><span>{existing.has(key) ? "Already in this folder" : elsewhere.has(key) ? "Exists elsewhere · ready to add" : "Ready to add"}</span></li>;
			})}
		</ul>
	</>;
}
