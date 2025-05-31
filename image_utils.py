# ===== image_utils.py =====
import io
from PIL import Image, ImageOps

# Supported image formats
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'}

def is_image_file(filename):
    """Check if file is an image"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

def create_thumbnail(image_data, size=(150, 150)):
    """Create thumbnail from image data"""
    try:
        image = Image.open(io.BytesIO(image_data))
        
        # Convert RGBA to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        
        # Create thumbnail maintaining aspect ratio
        image.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Save thumbnail to bytes
        thumbnail_io = io.BytesIO()
        image.save(thumbnail_io, format='JPEG', quality=85)
        return thumbnail_io.getvalue()
    except Exception as e:
        print(f"Error creating thumbnail: {e}")
        return None

def get_image_dimensions(image_data):
    """Get image width and height"""
    try:
        image = Image.open(io.BytesIO(image_data))
        return image.size  # Returns (width, height)
    except:
        return None, None