import io, os, tempfile, zipfile, shutil
from flask import Flask, request, send_file, jsonify

app = Flask(__name__, static_folder='.', static_url_path='')


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/convert', methods=['POST'])
def convert():
    from converter import batch_generate

    if 'file' not in request.files:
        return jsonify({'error': '파일이 없습니다.'}), 400

    upload = request.files['file']
    department = request.form.get('department', '').strip()

    if not upload.filename or not upload.filename.lower().endswith('.xlsx'):
        return jsonify({'error': '.xlsx 파일만 지원합니다.'}), 400

    tmpdir = tempfile.mkdtemp()
    try:
        xlsx_path = os.path.join(tmpdir, 'input.xlsx')
        output_dir = os.path.join(tmpdir, 'output')
        upload.save(xlsx_path)

        saved_files = batch_generate(xlsx_path, output_dir, department=department)

        if not saved_files:
            return jsonify({'error': '출장 신청 데이터를 찾을 수 없습니다.'}), 400

        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f_path in saved_files:
                zf.write(f_path, os.path.basename(f_path))
        zip_buf.seek(0)

        resp = send_file(
            zip_buf,
            as_attachment=True,
            download_name='출장여비정산서_일괄.zip',
            mimetype='application/zip',
        )
        resp.headers['X-Record-Count'] = str(len(saved_files))
        resp.headers['Access-Control-Expose-Headers'] = 'X-Record-Count'
        return resp

    except Exception as e:
        return jsonify({'error': f'변환 중 오류가 발생했습니다: {str(e)}'}), 500
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=True, host='0.0.0.0', port=port)
