import os
import glob
import subprocess
import time

def convert_doc_to_docx():
    # Define directories
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    TMP_DOWNLOAD_DIR = os.path.join(BASE_DIR, 'test-all/tmp_downloads')
    OUTPUT_DIR = os.path.join(BASE_DIR, 'test-all/converted_files')

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Find the latest .doc file
    doc_files = glob.glob(os.path.join(TMP_DOWNLOAD_DIR, '*.doc'))
    if not doc_files:
        print(f"❌ No .doc files found in {TMP_DOWNLOAD_DIR}")
        return

    latest_file = max(doc_files, key=os.path.getmtime)
    print(f"📂 Found Input file: {latest_file}")
    
    output_filename = os.path.basename(latest_file).replace('.doc', '.docx')
    output_path = os.path.join(OUTPUT_DIR, output_filename)

    # Workaround for macOS Sandbox "Grant File Access" dialog:
    # Microsoft Word is sandboxed and often demands explicit permission to read files in arbitrary user folders.
    # To bypass this without user interaction every time, we copy the file to a temporary directory that is generally globally accessible or less restricted.
    # We will use /tmp which is standard.
    
    import shutil
    
    # 1. Setup Sandbox-safe paths
    temp_dir = "/tmp/WordConversion"
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
        
    temp_input_filename = f"temp_{int(time.time())}_{os.path.basename(latest_file)}"
    temp_input_path = os.path.join(temp_dir, temp_input_filename)
    
    temp_output_filename = temp_input_filename.replace('.doc', '.docx')
    temp_output_path = os.path.join(temp_dir, temp_output_filename)
    
    # 2. Copy source file to temp dir
    print(f"📝 Copying to temporary sandbox path: {temp_input_path}")
    shutil.copy2(latest_file, temp_input_path)
    
    # 3. Prepare AppleScript with temp paths
    # Note: We use 'POSIX file' object in AppleScript for better file handling
    apple_script = f'''
    tell application "Microsoft Word"
        activate
        -- Try to minimize interaction
        set display alerts to none
        
        -- Use POSIX file path for robustness
        set inputFile to POSIX file "{temp_input_path}"
        set outputFile to "{temp_output_path}"
        
        with timeout of 600 seconds
            -- Open the document
            open inputFile
            
            set activeDoc to active document
            
            -- Save as .docx (file format 12 [document])
            -- We just pass the path string to file name (Word handles path string usually fine for save as)
            save as activeDoc file name outputFile file format format document
            
            -- Close
            close activeDoc saving no
        end timeout
        
        -- Restore alerts (removed to avoid variable 'all' syntax error)
        -- set display alerts to all 
    end tell
    '''
    
    print("🔄 Converting to .docx via Microsoft Word (AppleScript)...")
    
    try:
        process = subprocess.run(['osascript', '-e', apple_script], capture_output=True, text=True)
        
        if process.returncode == 0:
            # Check if temp output exists
            if os.path.exists(temp_output_path):
                # Move back to real output dir
                shutil.move(temp_output_path, output_path)
                
                file_size = os.path.getsize(output_path)
                print(f"✅ Success! Converted to: {output_path}")
                print(f"📦 Output Size: {file_size} bytes")
                
                # Cleanup temp input
                try: os.remove(temp_input_path) 
                except: pass
                
                # Open the file
                print("📂 Opening converted file...")
                subprocess.run(['open', output_path])
            else:
                 print("❌ Conversion failed: Output file not created in temp dir.")
        else:
            print(f"❌ AppleScript Error:\n{process.stderr}")
            
    except Exception as e:
        print(f"❌ Python Error: {e}")
        # Cleanup on error
        try: os.remove(temp_input_path)
        except: pass

if __name__ == "__main__":
    convert_doc_to_docx()
