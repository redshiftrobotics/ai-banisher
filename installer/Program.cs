using System.IO.Compression;

string? codePath = args.ElementAtOrDefault(1);
string? downloadPath = args.ElementAtOrDefault(2);

Stream? downloaded = null;

void ErrorOut(string message)
{
    Console.Error.WriteLine(message);
    Console.ResetColor();

    Environment.Exit(0);
}

void Help()
{
    Console.WriteLine($"{args[0]} [path-to-vscode-folder] [extension-file-path]");

    Environment.Exit(0);
}

bool TryFindVsCodePath(out string codePath)
{
    string[][] paths = [
        ["/Users", "Public", "wpilib", "2027_alpha7", "vscode"],
        [Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "wpilib", "2027_alpha7", "vscode", "VSCode-win-x64"],
        [Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".local", "share", "wpilib", "2027_alpha7", "vscode", "VSCode-linux-x64"]
    ];

    codePath = paths.Select(path => Path.GetFullPath(Path.Join(path))).FirstOrDefault(path => Directory.Exists(path)) ?? string.Empty;

    return codePath != string.Empty;
}

bool TryDownload(out Stream download)
{
    using HttpClient httpClient = new();
    httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0");

    Task<Stream> downloadTask = httpClient.GetStreamAsync("https://github.com/redshiftrobotics/ai-banisher/releases/download/1.0.0/ai-banisher.zip");
    downloadTask.Wait();

    download = downloadTask.Result;
    return true;
}

if (args.ElementAtOrDefault(1)?.Contains("help") == true || args.ElementAtOrDefault(1)?.StartsWith("-h") == true)
{
    Help();
    return;
}

if (codePath is null && !TryFindVsCodePath(out codePath))
{
    ErrorOut("VS Code can't be found or isn't installed.");
    Help();
}
else if (downloadPath is null && !TryDownload(out downloaded))
{
    ErrorOut("Failed to download the extension.");
    Help();
}
else
{
    try
    {
        if (downloadPath is not null)
        {
            downloaded = File.OpenRead(downloadPath);
        }

        if (downloaded is null)
        {
            ErrorOut("No download stream");
            return;
        }

        using ZipArchive zipArchive = new(downloaded);

        string extensionDestinationFolderPath = Path.Join(codePath, "resources/", "app/", "extensions/", "8032-ai");

        Directory.CreateDirectory(extensionDestinationFolderPath);

        zipArchive.ExtractToDirectory(extensionDestinationFolderPath);

        Console.WriteLine("Installed! :)");
    }
    catch (Exception e)
    {
        ErrorOut(e.ToString());
    }
}