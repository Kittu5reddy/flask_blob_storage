from flask import Flask, request, jsonify, send_file, render_template, Response
from werkzeug.utils import secure_filename
import io
from datetime import datetime
from database import init_db, get_db_connection
from image_utils import is_image_file, create_thumbnail, get_image_dimensions
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

@app.route('/')
def index():
    """Main page with upload interface"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload a file and store as blob in SQLite"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Read file data
        filename = secure_filename(file.filename)
        file_data = file.read()
        content_type = file.content_type
        file_size = len(file_data)
        
        # Check if it's an image
        is_image = is_image_file(filename) or (content_type and content_type.startswith('image/'))
        
        # Process image data
        thumbnail_data = None
        width, height = None, None
        
        if is_image:
            try:
                width, height = get_image_dimensions(file_data)
                thumbnail_data = create_thumbnail(file_data)
            except Exception as e:
                print(f"Error processing image: {e}")
                is_image = False
        
        # Store in database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO blobs (filename, content_type, data, thumbnail, size, width, height, is_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (filename, content_type, file_data, thumbnail_data, file_size, width, height, is_image))
        
        blob_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'blob_id': blob_id,
            'filename': filename,
            'size': file_size,
            'is_image': is_image,
            'dimensions': f"{width}×{height}" if width and height else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<int:blob_id>')
def download_blob(blob_id):
    """Download a blob by ID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT filename, content_type, data 
            FROM blobs WHERE id = ?
        ''', (blob_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return jsonify({'error': 'Blob not found'}), 404
        
        filename, content_type, data = result
        file_obj = io.BytesIO(data)
        
        return send_file(
            file_obj,
            mimetype=content_type or 'application/octet-stream',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/view/<int:blob_id>')
def view_image(blob_id):
    """View an image directly in browser"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT filename, content_type, data, is_image
            FROM blobs WHERE id = ?
        ''', (blob_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return jsonify({'error': 'Blob not found'}), 404
        
        filename, content_type, data, is_image = result
        
        if not is_image:
            return jsonify({'error': 'File is not an image'}), 400
        
        return Response(data, mimetype=content_type or 'image/jpeg')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/thumbnail/<int:blob_id>')
def get_thumbnail(blob_id):
    """Get thumbnail for an image"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT thumbnail, is_image
            FROM blobs WHERE id = ?
        ''', (blob_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result or not result['is_image']:
            return jsonify({'error': 'Image not found'}), 404
        
        thumbnail_data = result['thumbnail']
        
        if not thumbnail_data:
            return jsonify({'error': 'Thumbnail not available'}), 404
        
        return Response(thumbnail_data, mimetype='image/jpeg')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blobs', methods=['GET'])
def list_blobs():
    """Get list of all stored blobs"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, filename, content_type, size, width, height, is_image, uploaded_at
            FROM blobs ORDER BY uploaded_at DESC
        ''')
        
        blobs = []
        for row in cursor.fetchall():
            blobs.append({
                'id': row['id'],
                'filename': row['filename'],
                'content_type': row['content_type'],
                'size': row['size'],
                'width': row['width'],
                'height': row['height'],
                'is_image': bool(row['is_image']),
                'uploaded_at': row['uploaded_at']
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'blobs': blobs,
            'count': len(blobs)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blobs/<int:blob_id>', methods=['GET'])
def get_blob_info(blob_id):
    """Get information about a specific blob"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, filename, content_type, size, width, height, is_image, uploaded_at
            FROM blobs WHERE id = ?
        ''', (blob_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return jsonify({'error': 'Blob not found'}), 404
        
        blob_info = {
            'id': result['id'],
            'filename': result['filename'],
            'content_type': result['content_type'],
            'size': result['size'],
            'width': result['width'],
            'height': result['height'],
            'is_image': bool(result['is_image']),
            'uploaded_at': result['uploaded_at']
        }
        
        return jsonify({
            'success': True,
            'blob': blob_info
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blobs/<int:blob_id>', methods=['DELETE'])
def delete_blob(blob_id):
    """Delete a blob by ID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id FROM blobs WHERE id = ?', (blob_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Blob not found'}), 404
        
        cursor.execute('DELETE FROM blobs WHERE id = ?', (blob_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Blob {blob_id} deleted successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/images', methods=['GET'])  
def list_images():
    """Get list of only image blobs"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, filename, content_type, size, width, height, uploaded_at
            FROM blobs WHERE is_image = 1 ORDER BY uploaded_at DESC
        ''')
        
        images = []
        for row in cursor.fetchall():
            images.append({
                'id': row['id'],
                'filename': row['filename'],
                'content_type': row['content_type'],
                'size': row['size'],
                'width': row['width'],
                'height': row['height'],
                'uploaded_at': row['uploaded_at']
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'images': images,
            'count': len(images)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
