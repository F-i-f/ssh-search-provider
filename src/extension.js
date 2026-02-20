// -*- indent-tabs-mode: nil; -*-
// Ssh Search Provider for Gnome Shell
// Copyright (C) 2017-2026 Philippe Troin (F-i-f on Github)
// Copyright (c) 2013 Bernd Schlapsi
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import {
    Extension,
    gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Logger from './logger.js';

// Settings
const DEFAULT_TERMINAL_SCHEMA =
    'org.gnome.desktop.default-applications.terminal';
const DEFAULT_TERMINAL_KEY = 'exec';
const DEFAULT_TERMINAL_ARGS_KEY = 'exec-arg';
const FALLBACK_TERMINAL = {exec: 'gnome-terminal', args: '--', single: false};
const HOST_SEARCHSTRING = 'host ';

// A generic file, source of host names
class HostsSourceFile {
    constructor(logger, path) {
        this._logger = logger;
        this._lastSearchHadUserPart = null;
        this._hosts = [];

        this._canonicalPath = path;
        this._canonicalFile = Gio.file_new_for_path(this._canonicalPath);

        this._path = this._canonicalPath;
        this._file = this._canonicalFile;

        this._symlinkTarget = null;
        this._symlinkPath = null;
        this._symlinkFile = null;

        this._symlinkChangeMonitor = null;
        this._symlinkChangeSignal = null;

        this._fileChangeMonitor = this._file.monitor_file(
            Gio.FileMonitorFlags.NONE,
            null
        );
        this._fileChangeSignal = this._fileChangeMonitor.connect(
            'changed',
            this.onFileChange.bind(this)
        );

        this.onFileChange(
            this._fileChangeMonitor,
            this._file,
            null,
            Gio.FileMonitorEvent.CHANGES_DONE_HINT
        );
    }

    cleanup() {
        if (this._symlinkChangeMonitor !== null) {
            this._symlinkChangeMonitor.disconnect(this._symlinkChangeSignal);
            this._symlinkChangeSignal = null;
            this._symlinkChangeMonitor.cancel();
            this._symlinkChangeMonitor = null;
        }
        this._fileChangeMonitor.disconnect(this._fileChangeSignal);
        this._fileChangeSignal = null;
        this._fileChangeMonitor.cancel();
        this._fileChangeMonitor = null;
    }

    getHosts() {
        return this._hosts;
    }

    _changeLinkTarget(target) {
        this._symlinkTarget = target;
        this._path = this._symlinkTarget;
        if (this._path[0] !== '/')
            this._path = `${this._symlinkFile.get_parent().get_path()}/{this._path}`;

        this._file = Gio.file_new_for_path(this._path);
        this._fileChangeMonitor = this._file.monitor_file(
            Gio.FileMonitorFlags.NONE,
            null
        );
        this._fileChangeSignal = this._fileChangeMonitor.connect(
            'changed',
            this.onFileChange.bind(this)
        );
    }

    onSymlinkChange(filemonitor, file, otherFile, eventType) {
        if (
            (this._symlinkFile === null ||
                file.get_path() === this._symlinkFile.get_path()) &&
            (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                eventType === Gio.FileMonitorEvent.DELETED)
        ) {
            this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}, ${eventType})`);
            let queryinfo = null;
            try {
                queryinfo = this._canonicalFile.query_info('standard', 0, null);
            } catch (ex) {
                this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): file doesn't exist: ${ex}`);
            }
            if (queryinfo !== null && queryinfo.get_is_symlink()) {
                const curLinkTarget = queryinfo.get_symlink_target();
                if (curLinkTarget === this._symlinkTarget) {
                    this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): symlink target still ${this._symlinkTarget}`);
                } else if (this._symlinkTarget === null) {
                    this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): changed from regular to symlink to ${curLinkTarget}`);
                    this._fileChangeMonitor.disconnect(this._fileChangeSignal);
                    this._symlinkPath = this._path;
                    this._symlinkFile = this._file;
                    this._symlinkChangeMonitor = this._fileChangeMonitor;
                    this._symlinkChangeSignal =
                        this._symlinkChangeMonitor.connect(
                            'changed',
                            this.onSymlinkChange.bind(this)
                        );

                    this._changeLinkTarget(curLinkTarget);
                } else {
                    this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): symlink target changed from ${this._symlinkTarget} to ${curLinkTarget}`);
                    this._fileChangeMonitor.disconnect(this._fileChangeSignal);
                    this._fileChangeMonitor.cancel();

                    this._changeLinkTarget(curLinkTarget);

                    this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): triggering onFileChange()`);
                    this.onFileChange(
                        this._fileChangeMonitor,
                        this._file,
                        null,
                        Gio.FileMonitorEvent.CHANGES_DONE_HINT
                    );
                }
            } else if (this._symlinkTarget === null) {
                this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): still not a symlink`);
            } else {
                this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): changed from symlink to regular`);

                this._fileChangeMonitor.disconnect(this._fileChangeSignal);
                this._fileChangeMonitor.cancel();

                this._symlinkChangeMonitor.disconnect(
                    this._symlinkChangeSignal
                );

                this._path = this._symlinkPath;
                this._file = this._symlinkFile;
                this._fileChangeMonitor = this._symlinkChangeMonitor;

                this._symlinkTarget = null;
                this._symlinkFile = null;
                this._symlinkPath = null;
                this._symlinkChangeMonitor = null;
                this._symlinkChangeSignal = null;

                this._fileChangeMonitor.connect(
                    'changed',
                    this.onFileChange.bind(this)
                );
                this._logger.log_debug(`HostsSourceFile.onSymlinkChange(${file.get_path()}): triggering onFileChange()`);
                this.onFileChange(
                    this._fileChangeMonitor,
                    this._file,
                    null,
                    Gio.FileMonitorEvent.CHANGES_DONE_HINT
                );
            }
        }
    }

    onFileChange(filemonitor, file, otherFile, eventType) {
        if (
            file.get_path() === this._file.get_path() &&
            (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                eventType === Gio.FileMonitorEvent.DELETED)
        ) {
            this._logger.log_debug(`HostsSourceFile.onFileChange(${file.get_path()}, ${eventType})`);

            if (this._symlinkTarget === null) {
                this._logger.log_debug(`HostsSourceFile.onFileChange(${file.get_path()}): triggering onSymlinkChange()`);
                this.onSymlinkChange(
                    null,
                    this._canonicalFile,
                    null,
                    eventType
                );
            }

            const hosts = [];
            if (file.query_exists(null)) {
                const contents = this._canonicalFile.load_contents(null);
                const decoder = new TextDecoder();
                const filelines = decoder.decode(contents[1]).trim().split('\n');
                for (const i in this.parse(filelines))
                    hosts.push(i);
            }
            this._hosts = hosts;
            this._logger.log_debug(`HostsSourceFile.onFileChange(${file.get_path()}) = ${this._hosts.length}[${this._hosts}]`);
        }
    }
}

// SSH config file
class ConfigHostsSourceFile extends HostsSourceFile {
    parse(filelines) {
        const hostsDict = {};

        // search for all lines which begins with "host"
        for (let i = 0; i < filelines.length; i++) {
            const line = filelines[i].toString();
            if (line.toLowerCase().lastIndexOf(HOST_SEARCHSTRING, 0) === 0) {
                // read all hostnames in the host definition line
                const hostnames = line.slice(HOST_SEARCHSTRING.length).split(' ');
                for (let j = 0; j < hostnames.length; j++) {
                    const h = hostnames[j];
                    if (h.indexOf('*') === -1)
                        hostsDict[h] = 1;
                }
            }
        }

        return hostsDict;
    }
}

// SSH Known hosts file
class SshKnownHostsSourceFile extends HostsSourceFile {
    parse(filelines) {
        const hostsDict = {};

        for (let i = 0; i < filelines.length; i++) {
            let hostnames = filelines[i].split(' ')[0];

            // if hostname had a 60 char length, it looks like
            // the hostname is hashed and we ignore it here
            if (
                hostnames.length > 0 &&
                hostnames[0] !== '#' &&
                (hostnames.length !== 60 || hostnames.search(',') >= 0)
            ) {
                hostnames = hostnames.split(',');
                for (let j = 0; j < hostnames.length; j++)
                    hostsDict[hostnames[j]] = 1;
            }
        }

        return hostsDict;
    }
}

// The Search provider
class SshSearchProvider {
    constructor(extension) {
        this._settings = extension._settings;
        this._logger = extension._logger;

        this._logger.log_debug('SshSearchProvider.constructor()');

        this.id = extension.metadata.uuid;
        this.appInfo = Gio.DesktopAppInfo.new(
            this._settings.get_string('terminal-application')
        );
        if (this.appInfo !== null) {
            this.appInfo.get_name = function () {
                return _('SSH');
            };
        }
        this.title = 'SSHSearch';

        this._hostsSources = [];

        this._hostsSources.push(
            new ConfigHostsSourceFile(
                this._logger,
                GLib.build_filenamev([GLib.get_home_dir(), '/.ssh/', 'config'])
            )
        );
        this._hostsSources.push(
            new ConfigHostsSourceFile(this._logger, '/etc/ssh_config')
        );
        this._hostsSources.push(
            new ConfigHostsSourceFile(this._logger, '/etc/ssh/ssh_config')
        );

        this._hostsSources.push(
            new SshKnownHostsSourceFile(
                this._logger,
                GLib.build_filenamev([
                    GLib.get_home_dir(),
                    '/.ssh/',
                    'known_hosts',
                ])
            )
        );
        this._hostsSources.push(
            new SshKnownHostsSourceFile(this._logger, '/etc/ssh_known_hosts')
        );
        this._hostsSources.push(
            new SshKnownHostsSourceFile(
                this._logger,
                '/etc/ssh/ssh_known_hosts'
            )
        );
    }

    _cleanup() {
        this._logger.log_debug('SshSearchProvider._cleanup()');

        for (let i = 0; i < this._hostsSources.length; ++i)
            this._hostsSources[i].cleanup();
    }

    // Search API
    createResultObject(_result, _terms) {
        // this._logger.log_debug('SshSearchProvider.createResultObject('+terms+')');
        return null;
    }

    _createIcon(size) {
        let icon = this.appInfo?.get_icon();
        if (!icon)
            icon = Gio.icon_new_for_string('applications-other');
        return new St.Icon({gicon: icon, icon_size: size});
    }

    getResultMetas(resultIds, _cancellable) {
        this._logger.log_debug(`SshSearchProvider.getResultMetas(${resultIds})`);
        const results = [];
        for (let i = 0; i < resultIds.length; ++i) {
            results.push({
                id: resultIds[i],
                name: resultIds[i],
                createIcon: this._createIcon.bind(this),
            });
        }
        return results;
    }

    activateResult(id) {
        this._logger.log_debug(`SshSearchProvider.activateResult(${id})`);
        const terminalDefinition = this._getDefaultTerminal();
        const cmd = [terminalDefinition.exec];
        cmd.push(...terminalDefinition.args.trim().split(/\s+/));

        let host = id;
        let user = null;
        let port = null;

        const atIndex = host.indexOf('@');
        if (atIndex >= 0) {
            user = host.slice(0, atIndex);
            host = host.slice(atIndex + 1);
        }

        if (host[0] === '[') {
            const parts = host.slice(1).split(']:');
            if (parts.length === 2) {
                host = parts[0];
                port = parts[1];
            }
        }

        if (user !== null)
            host = `${user}@${host}`;

        let sshCmd;
        if (port === null)
            sshCmd = ['ssh', host];
        else
            sshCmd = ['ssh', '-p', port, host];

        if (terminalDefinition.single)
            cmd.push(sshCmd.join(' '));
        else
            cmd.push(...sshCmd);

        // start terminal with ssh command
        this._logger.log_debug(`SshSearchProvider.activateResult(): cmd=${cmd}`);
        Util.spawn(cmd);
    }

    filterResults(providerResults, maxResults) {
        this._logger.log_debug(`SshSearchProvider.filterResults(${maxResults})`);
        return providerResults;
    }

    getInitialResultSet(terms, _cancellable) {
        this._logger.log_debug(`SshSearchProvider.getInitialResultSet(${terms})`);

        // check if a found host-name begins like the search-term
        const resultsDict = {};
        this._lastSearchHadUserPart = false;

        for (let ti = 0; ti < terms.length; ti++) {
            let user = null;
            let host = terms[ti];
            const hostAtSign = host.indexOf('@');
            if (hostAtSign === 0 || hostAtSign === host.length - 1) {
                // Invalid user name or nothing after @ sign: skip search term
                continue;
            } else if (hostAtSign > 0) {
                user = host.slice(0, hostAtSign);
                host = host.slice(hostAtSign + 1);
                this._lastSearchHadUserPart = true;
            }

            for (let hsi = 0; hsi < this._hostsSources.length; ++hsi) {
                const hostnames = this._hostsSources[hsi].getHosts();
                for (let i = 0; i < hostnames.length; i++) {
                    if (hostnames[i].indexOf(host) >= 0) {
                        let sshName = hostnames[i];
                        if (user !== null)
                            sshName = `${user}@${sshName}`;
                        resultsDict[sshName] = 1;
                    }
                }
            }
        }

        const results = [];
        for (const i in resultsDict)
            results.push(i);

        this._logger.log_debug(`SshSearchProvider.getInitialResultSet(${terms}) = ${results.length}[${results}]`);

        return results;
    }

    getSubsearchResultSet(previousResults, terms, cancellable) {
        this._logger.log_debug(`SshSearchProvider.getSubsearchResultSet(${terms})`);
        const results = [];
        for (let ti = 0; ti < terms.length; ti++) {
            const term = terms[ti];
            const termAtIndex = term.indexOf('@');
            if (termAtIndex === term.length - 1) {
                // Skip term if nothing is present after the @ sign.
                continue;
            }
            if (
                (termAtIndex >= 0 && !this._lastSearchHadUserPart) ||
                (termAtIndex < 0 && this._lastSearchHadUserPart)
            ) {
                // If the query switches from having to not having a user
                // part, we must restart the search from scratch.
                return this.getInitialResultSet(terms, cancellable);
            }
            let termHost = term;
            if (termAtIndex >= 0)
                termHost = term.slice(termAtIndex + 1);

            for (let i = 0; i < previousResults.length; ++i) {
                const previousResult = previousResults[i];
                const previousResultAtIndex = previousResult.indexOf('@');
                let previousHost = previousResult;
                if (previousResultAtIndex >= 0) {
                    previousHost = previousResult.slice(
                        previousResultAtIndex + 1
                    );
                }
                if (previousHost.indexOf(termHost) >= 0)
                    results.push(previousResult);
            }
        }
        this._logger.log_debug(`SshSearchProvider.getSubsearchResultSet(${terms}) = ${results.length}[${results}]`);
        return results;
    }

    // try to find the default terminal app. fallback is gnome-terminal
    _getDefaultTerminal() {
        if (this.appInfo !== null) {
            return {
                exec: this.appInfo.get_executable(),
                args: this._settings.get_string(
                    'terminal-application-arguments'
                ),
                single: this._settings.get_boolean(
                    'ssh-command-single-argument'
                ),
            };
        }

        try {
            if (Gio.Settings.list_schemas().indexOf(DEFAULT_TERMINAL_SCHEMA) === -1)
                return FALLBACK_TERMINAL;

            const terminalSetting = new Gio.Settings({
                schema: DEFAULT_TERMINAL_SCHEMA,
            });
            return {
                exec: terminalSetting.get_string(DEFAULT_TERMINAL_KEY),
                args: terminalSetting.get_string(DEFAULT_TERMINAL_ARGS_KEY),
                single: false,
            };
        } catch (ex) {
            this._logger.log_debug(`SshSearchProvider._getDefaultTerminal(): ${ex}`);
            return FALLBACK_TERMINAL;
        }
    }
}

// The extension
export default class SshSearchProviderExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._logger = null;
        this._debugSettingChangedConnection = null;
        this._onTerminalApplicationChangedSignal = null;
        this._settings = null;
        this._sshSearchProvider = null;
        this._searchResults = null;
        this._delayedRegistration = null;
    }

    _on_debug_change() {
        this._logger.set_debug(this._settings.get_boolean('debug'));
        this._logger.log_debug(`SshSearchProviderExtension._on_debug_change(): debug = ${this._logger.get_debug()}`);
    }

    _on_terminal_application_change() {
        this._logger.log_debug(
            'SshSearchProviderExtension._on_terminal_application_change()'
        );
        this._unregisterProvider();
        this._registerProvider();
    }

    _registerProvider() {
        this._logger.log_debug(
            'SshSearchProviderExtension._registerProvider()'
        );
        if (!this._sshSearchProvider) {
            this._sshSearchProvider = new SshSearchProvider(this);
            this._searchResults._registerProvider(this._sshSearchProvider);
        }
    }

    enable() {
        if (!this._logger) {
            this._logger = new Logger.Logger(
                'Ssh-Search-Provider',
                this.metadata
            );
        }

        if (!this._settings)
            this._settings = this.getSettings();

        // Gnome-Shell 40 compatibility
        if (Main.overview._overview.controls !== undefined) {
            // GS 40+
            this._searchResults =
                Main.overview._overview.controls._searchController._searchResults;
        } else {
            // GS 38-
            this._searchResults = Main.overview.viewSelector._searchResults;
        }

        this._on_debug_change();
        this._logger.log_debug('SshSearchProviderExtension.enable()');

        if (!this._onDebugChangedSignal) {
            this._onDebugChangedSignal = this._settings.connect(
                'changed::debug',
                this._on_debug_change.bind(this)
            );
        }

        if (!this._onTerminalApplicationChangedSignal) {
            this._onTerminalApplicationChangedSignal = this._settings.connect(
                'changed::terminal-application',
                this._on_terminal_application_change.bind(this)
            );
        }

        this._delayedRegistration = GLib.idle_add(
            GLib.PRIORITY_DEFAULT_IDLE,
            () => {
                this._registerProvider();
                this._delayedRegistration = null;
                return GLib.SOURCE_REMOVE;
            }
        );

        this._logger.log_debug('extension enabled');
    }

    _unregisterProvider() {
        this._logger.log_debug(
            'SshSearchProviderExtension._unregisterProvider()'
        );

        if (this._delayedRegistration !== null) {
            GLib.source_remove(this._delayedRegistration);
            this._delayedRegistration = null;
        }

        if (this._sshSearchProvider) {
            this._searchResults._unregisterProvider(this._sshSearchProvider);
            this._sshSearchProvider._cleanup();
            this._sshSearchProvider = null;
        }
    }

    disable() {
        this._logger.log_debug('SshSearchProviderExtension.disable()');

        this._unregisterProvider();

        if (this._onTerminalApplicationChangedSignal) {
            this._settings.disconnect(this._onTerminalApplicationChangedSignal);
            this._onTerminalApplicationChangedSignal = null;
        }

        if (this._onDebugChangedSignal) {
            this._settings.disconnect(this._onDebugChangedSignal);
            this._onDebugChangedSignal = null;
        }

        this._searchResults = null;
        this._settings = null;

        this._logger.log_debug('extension disabled');
        this._logger = null;
    }
}
