import io, os, tempfile, shutil
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
    department     = request.form.get('department', '').strip()
    transport_type = request.form.get('transport_type', '자가용').strip()
    departure              = request.form.get('departure', '').strip()
    arrival                = request.form.get('arrival', '').strip()
    accommodation_limit    = request.form.get('accommodation_limit', '').strip()
    accommodation_actual   = request.form.get('accommodation_actual', '').strip()
    accommodation_reason   = request.form.get('accommodation_reason', '').strip()

    if not upload.filename or not upload.filename.lower().endswith('.xlsx'):
        return jsonify({'error': '.xlsx 파일만 지원합니다.'}), 400

    tmpdir = tempfile.mkdtemp()
    try:
        xlsx_path = os.path.join(tmpdir, 'input.xlsx')
        output_dir = os.path.join(tmpdir, 'output')
        upload.save(xlsx_path)

        saved_files = batch_generate(
            xlsx_path, output_dir,
            department=department, transport_type=transport_type,
            departure=departure, arrival=arrival,
            accommodation_limit=accommodation_limit,
            accommodation_actual=accommodation_actual,
            accommodation_reason=accommodation_reason,
        )

        if not saved_files:
            return jsonify({'error': '출장 신청 데이터를 찾을 수 없습니다.'}), 400

        docx_path = saved_files[0]
        with open(docx_path, 'rb') as f:
            buf = io.BytesIO(f.read())

        return send_file(
            buf,
            as_attachment=True,
            download_name=os.path.basename(docx_path),
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

    except Exception as e:
        return jsonify({'error': f'변환 중 오류가 발생했습니다: {str(e)}'}), 500
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=True, host='0.0.0.0', port=port)
