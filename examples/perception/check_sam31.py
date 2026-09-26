import argparse
import base64
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--endpoint", default="http://127.0.0.1:8005/segment")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    image_bytes = args.image.read_bytes()
    with Image.open(args.image) as image:
        image.load()
        width, height = image.size
        mime_type = Image.MIME[image.format]
    payload = json.dumps(
        {
            "image_base64": base64.b64encode(image_bytes).decode("ascii"),
            "image_mime_type": mime_type,
            "text_prompt": args.prompt,
        }
    ).encode("utf8")
    request = Request(
        args.endpoint,
        data=payload,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=600) as response:
        result = json.load(response)
    if result["width"] != width or result["height"] != height:
        raise ValueError("Segmentation dimensions differ from the source image.")
    args.output.mkdir(parents=True, exist_ok=True)
    overlay = base64.b64decode(result["overlay_png_base64"], validate=True)
    (args.output / "overlay.png").write_bytes(overlay)
    with Image.open(args.output / "overlay.png") as overlay_image:
        if overlay_image.size != (width, height):
            raise ValueError("Overlay dimensions differ from the source image.")
    instances = []
    for index, instance in enumerate(result["instances"]):
        mask = base64.b64decode(instance["mask_png_base64"], validate=True)
        mask_path = args.output / f"mask-{index:02d}.png"
        mask_path.write_bytes(mask)
        with Image.open(mask_path) as mask_image:
            if mask_image.size != (width, height):
                raise ValueError("Mask dimensions differ from the source image.")
        instances.append({key: value for key, value in instance.items() if key != "mask_png_base64"})
    report = {
        "source_image": str(args.image),
        "source_image_sha256": hashlib.sha256(image_bytes).hexdigest(),
        "prompt": args.prompt,
        "model": result["model"],
        "width": width,
        "height": height,
        "instance_count": len(instances),
        "instances": instances,
        "overlay_sha256": hashlib.sha256(overlay).hexdigest(),
    }
    (args.output / "result.json").write_text(json.dumps(report, indent=2), encoding="utf8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
