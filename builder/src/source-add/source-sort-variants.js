import { DEFAULT_DISCOVER_SORT_OPTION_ID, DISCOVER_SORT_OPTIONS, discoverSortOptionId } from "../nuvio/discover.js";

// Creation-only selection. Persisted sources and editors continue to use one sort.
export function orderedSourceSortIds(sortOptionIds, sortOptionId = DEFAULT_DISCOVER_SORT_OPTION_ID, options = DISCOVER_SORT_OPTIONS) {
	const supplied = sortOptionIds === undefined ? [sortOptionId] : sortOptionIds;
	if (!Array.isArray(supplied) || supplied.length === 0
		|| new Set(supplied).size !== supplied.length
		|| [...supplied].some((id) => !options.some((option) => option.id === id))) return null;
	return Object.freeze(options.filter((option) => supplied.includes(option.id)).map((option) => option.id));
}

export function sourceDraftSortId(draft) {
	return discoverSortOptionId(draft?.editable?.sortBy, draft?.editable?.mediaType);
}

export function sourceSortLabel(sortId) {
	return DISCOVER_SORT_OPTIONS.find((option) => option.id === sortId)?.label ?? "";
}

export function sourceSortSelectionError(sortOptionIds, fallback) {
	return Array.isArray(sortOptionIds) && sortOptionIds.length === 0 ? "Choose at least one option." : fallback;
}
