"""Contract test：同一组用例参数化跑 local_fs 与 opendal(fs)，守护 StorageAdapter Protocol 行为一致。"""


def test_put_get_roundtrip(storage):
    st, root = storage
    src = root / 'src.bin'
    src.write_bytes(b'\x00\x01\x02raw')
    st.put_file(src, str(root / 'nested' / 'copied.bin'))
    out = st.get_file(str(root / 'nested' / 'copied.bin'), root / 'back.bin')
    assert out.read_bytes() == b'\x00\x01\x02raw'


def test_exists_and_size(storage):
    st, root = storage
    f = root / 'a.txt'
    f.write_bytes(b'hello-size')
    assert st.exists(str(f)) is True
    assert st.exists(str(root / 'missing.txt')) is False
    assert st.size(str(f)) == len(b'hello-size')


def test_open_text_roundtrip(storage):
    st, root = storage
    uri = str(root / 'note.txt')
    with st.open(uri, 'w') as h:
        h.write('line-1\n')
    with st.open(uri, 'r') as h:
        assert h.read() == 'line-1\n'


def test_open_binary_read(storage):
    st, root = storage
    f = root / 'b.bin'
    f.write_bytes(b'BINARY')
    with st.open(str(f), 'rb') as h:
        assert h.read() == b'BINARY'


def test_delete_is_idempotent(storage):
    st, root = storage
    f = root / 'gone.txt'
    f.write_bytes(b'x')
    st.delete(str(f))
    assert st.exists(str(f)) is False
    st.delete(str(f))  # 二次删除不报错


def test_list_files(storage):
    st, root = storage
    (root / 'd').mkdir()
    (root / 'd' / 'one.txt').write_bytes(b'1')
    (root / 'd' / 'two.txt').write_bytes(b'2')
    names = sorted(p.name for p in st.list_files(root / 'd'))
    assert names == ['one.txt', 'two.txt']
