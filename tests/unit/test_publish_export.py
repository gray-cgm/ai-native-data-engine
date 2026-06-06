"""publish_export：把导出 artifact（Lance 目录 / 单文件）经 StorageAdapter 发布到任意后端。"""


def test_publish_single_file(opendal_fs, tmp_path):
    from workflows.exports import publish_export

    st, dest_root = opendal_fs
    src = tmp_path / 'one.jsonl'
    src.write_text('{"a":1}\n')
    keys = publish_export(st, src, str(dest_root / 'exports' / 'one.jsonl'))
    assert len(keys) == 1
    assert (dest_root / 'exports' / 'one.jsonl').read_text() == '{"a":1}\n'


def test_publish_directory_tree(opendal_fs, tmp_path):
    """模拟 Lance 导出目录（多文件 + 子目录），整树保结构上传。"""
    from workflows.exports import publish_export

    st, dest_root = opendal_fs
    export = tmp_path / 'export'
    (export / 'data').mkdir(parents=True)
    (export / 'data' / 'part-0.parquet').write_bytes(b'PARQ0')
    (export / '_versions').mkdir()
    (export / '_versions' / '1.txt').write_text('v1')

    keys = publish_export(st, export, str(dest_root / 'exports' / 'v1.lance'))
    assert len(keys) == 2
    assert (dest_root / 'exports' / 'v1.lance' / 'data' / 'part-0.parquet').read_bytes() == b'PARQ0'
    assert (dest_root / 'exports' / 'v1.lance' / '_versions' / '1.txt').read_text() == 'v1'
