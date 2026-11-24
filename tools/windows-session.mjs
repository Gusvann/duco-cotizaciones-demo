import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const run=promisify(execFile);
const sidPattern=/^S-1-\d+(?:-\d+)+$/;

async function windowsSid(script) {
  if(process.platform!=='win32')return null;
  const shell=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
  const {stdout}=await run(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',
    "$ErrorActionPreference='Stop'\n"+script],{timeout:30000,maxBuffer:16384,windowsHide:true});
  const sid=stdout.trim();
  return sidPattern.test(sid)?sid:null;
}

export const currentWindowsSid=()=>windowsSid('[Security.Principal.WindowsIdentity]::GetCurrent().User.Value');

// Windows owns this endpoint table. Browser-supplied names and headers never
// identify the Windows principal. Both ends must still belong to this live socket.
export async function windowsPeerSid(socket) {
  const {localPort,remotePort,localAddress,remoteAddress}=socket;
  if(localAddress!=='127.0.0.1'||remoteAddress!=='127.0.0.1'||
     ![localPort,remotePort].every(port=>Number.isInteger(port)&&port>0&&port<=65535))return null;
  const sid=await windowsSid(`
    $peers=@(Get-NetTCPConnection -State Established -LocalAddress '127.0.0.1' -RemoteAddress '127.0.0.1' -LocalPort ${remotePort} -RemotePort ${localPort})
    if ($peers.Count -ne 1) { exit 0 }
    $peer=Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = '+$peers[0].OwningProcess)
    if (!$peer -or $peer.SessionId -ne [Diagnostics.Process]::GetCurrentProcess().SessionId) { exit 0 }
    $owner=Invoke-CimMethod -InputObject $peer -MethodName GetOwnerSid
    $current=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ($owner.ReturnValue -eq 0 -and $owner.Sid -eq $current) { $current }
  `);
  return socket.destroyed?null:sid;
}
