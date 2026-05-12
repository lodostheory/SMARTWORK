# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  channel = "stable-24.11";
  packages = [
    pkgs.nodejs_22
    pkgs.python3
  ];
  env = {};
  idx = {
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
    ];
    previews = {
      enable = true;
      previews = {
        web = {
          command = [".venv/bin/python3" "app.py"];
          manager = "web";
        };
      };
    };
    workspace = {
      onCreate = {
        pip-install = "python3 -m venv .venv && .venv/bin/pip install flask openpyxl python-docx -q";
        default.openFiles = [ "style.css" "main.js" "index.html" ];
      };
      onStart = {};
    };
  };
}
