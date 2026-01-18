Import("env")
import shutil
import os

def copy_firmware(source, target, env):
    # Get firmware version from source file
    version = "2.0.0"  # Default version
    
    # Create output directory
    output_dir = os.path.join(env.get("PROJECT_DIR"), "bin")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Copy firmware.bin to bin folder with version
    src = str(target[0])
    dst = os.path.join(output_dir, f"firmware-v{version}.bin")
    
    shutil.copy(src, dst)
    print(f"\n✓ Firmware copied to: {dst}")
    print(f"  Size: {os.path.getsize(dst):,} bytes")

env.AddPostAction("$BUILD_DIR/firmware.bin", copy_firmware)
