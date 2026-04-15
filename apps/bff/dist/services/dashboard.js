import { platformFetch } from './platform.js';
export async function buildDashboardPayload() {
    const [distributionRes, datasetsRes, tasksRes, workspacesRes, exportsRes, searchRes, runsRes] = await Promise.all([
        platformFetch('/samples/distribution'),
        platformFetch('/datasets'),
        platformFetch('/tasks'),
        platformFetch('/workspaces'),
        platformFetch('/exports'),
        platformFetch('/samples/search-preview'),
        platformFetch('/runs'),
    ]);
    const datasets = (datasetsRes.items ?? []);
    const versionEntries = await Promise.all(datasets.map(async (item) => {
        const detail = (await platformFetch(`/datasets/${item.dataset_id}`));
        return [item.dataset_id, detail.versions ?? []];
    }));
    return {
        distribution: (distributionRes.distribution ?? []),
        scenario: (distributionRes.scenario ?? null),
        datasets,
        datasetVersions: Object.fromEntries(versionEntries),
        tasks: (tasksRes.items ?? []),
        workspaces: (workspacesRes.items ?? []),
        exports: (exportsRes.items ?? []),
        runs: (runsRes.items ?? []),
        searchRows: (searchRes.rows ?? []),
    };
}
