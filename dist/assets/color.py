from PIL import Image

def convert_white_to_color(image_path, output_path, target_color=(242, 191, 67)):
    # Open the image
    img = Image.open(image_path)

    # Get the image data
    img_data = img.getdata()

    # Convert every white pixel to the target color
    # new_data = [(target_color[0], target_color[1], target_color[2], pixel[3]) if pixel[:3] == (255, 255, 255) else pixel for pixel in img_data]
    new_data = [(255, 255, 255, 0) if pixel[0:3] == (255,255,255) else pixel for pixel in img_data]

    # Create a new image with the modified data
    new_img = Image.new("RGBA", img.size)
    new_img.putdata(new_data)

    # Save the new image
    new_img.save(output_path, "PNG")

if __name__ == "__main__":
    # Specify the input and output paths
    input_image_path = './banned.png'
    output_image_path = './bannedcopy.png'

    # Convert white pixels to another color (e.g., RGB(242, 191, 67))
    convert_white_to_color(input_image_path, output_image_path)