// -*- indent-tabs-mode: nil; -*-
// Ssh Search Provider for Gnome Shell
// Copyright (C) 2019-2026 Philippe Troin (F-i-f on Github)
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
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

const loadDesktopAppInfo = async () => {
    let gioImpl;
    try {
        gioImpl = await import('gi://GioUnix');
    } catch (unused) {
        gioImpl = await import('gi://Gio');
    }
    if (gioImpl?.default?.DesktopAppInfo)
        return gioImpl.default.DesktopAppInfo;
    else
        throw new Error('DesktopAppInfo not found');
};
const DesktopAppInfo = await loadDesktopAppInfo();

import * as Logger from './logger.js';

const ArgumentsForTerminalApp = {
    'guake.desktop': {args: '-n new --show -e', single: true},
    'rxvt.desktop': {args: '-e', single: false},
    'org.gnome.Console.desktop': {args: '--', single: false},
    'org.gnome.Terminal.desktop': {args: '--', single: false},
    'com.gexperts.Tilix.desktop': {args: '-e', single: true},
    'xterm.desktop': {args: '-e', single: true},
};

export default class SshSearchProviderSettings extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const grid = new Gtk.Grid();
        grid.margin_top = 12;
        grid.margin_bottom = grid.margin_top;
        grid.margin_start = 48;
        grid.margin_end = grid.margin_start;
        grid.row_spacing = 6;
        grid.column_spacing = grid.row_spacing;
        grid.orientation = Gtk.Orientation.VERTICAL;

        const settings = this.getSettings();
        const logger = new Logger.Logger(
            'Ssh-Search-Provider/prefs',
            this.metadata
        );
        logger.set_debug(settings.get_boolean('debug'));

        let ypos = 1;

        const titleLabel = new Gtk.Label({
            use_markup: true,
            label: `<span size="large" weight="heavy">${_('SSH Search Provider Reborn')}</span>`,
            hexpand: true,
            halign: Gtk.Align.CENTER,
        });
        grid.attach(titleLabel, 1, ypos, 2, 1);

        ypos += 1;

        const versionLabel = new Gtk.Label({
            use_markup: true,
            label: `<span size="small">${_('Version')} ${logger.get_version()}</span>`,
            hexpand: true,
            halign: Gtk.Align.CENTER,
        });
        grid.attach(versionLabel, 1, ypos, 2, 1);

        ypos += 1;

        const linkLabel = new Gtk.Label({
            use_markup: true,
            label: `<span size="small"><a href="${this.metadata.url}">${this.metadata.url}</a></span>`,
            hexpand: true,
            halign: Gtk.Align.CENTER,
            margin_bottom: grid.margin_bottom,
        });
        grid.attach(linkLabel, 1, ypos, 2, 1);

        ypos += 1;

        const termAppDescr = _(
            settings.settings_schema
                .get_key('terminal-application')
                .get_description()
        );
        const termAppLabel = new Gtk.Label({
            label: _('Terminal Application:'),
            halign: Gtk.Align.START,
        });
        termAppLabel.set_tooltip_text(termAppDescr);

        const termAppControlImage = new Gtk.Image();
        const termAppControlLabel = new Gtk.Label();
        this._on_terminal_application_change(
            settings,
            termAppControlLabel,
            termAppControlImage
        );
        const termAppControlBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            spacing: 10,
        });
        termAppControlBox.append(termAppControlImage);
        termAppControlBox.append(termAppControlLabel);
        const termAppControl = new Gtk.Button({child: termAppControlBox});
        termAppControl.set_tooltip_text(termAppDescr);
        termAppControl.connect('clicked', () => {
            this._on_click_terminal_app(settings, grid);
        });

        grid.attach(termAppLabel, 1, ypos, 1, 1);
        grid.attach(termAppControl, 2, ypos, 1, 1);
        settings.connect('changed::terminal-application', () => {
            this._on_terminal_application_change(
                settings,
                termAppControlLabel,
                termAppControlImage
            );
        });

        ypos += 1;

        const termAppArgsDescr = _(
            settings.settings_schema
                .get_key('terminal-application-arguments')
                .get_description()
        );
        const termAppArgsLabel = new Gtk.Label({
            label: _('Arguments:'),
            halign: Gtk.Align.START,
        });
        termAppArgsLabel.set_tooltip_text(termAppArgsDescr);
        const termAppArgsControl = new Gtk.Entry();
        termAppArgsControl.set_tooltip_text(termAppArgsDescr);
        grid.attach(termAppArgsLabel, 1, ypos, 1, 1);
        grid.attach(termAppArgsControl, 2, ypos, 1, 1);
        settings.bind(
            'terminal-application-arguments',
            termAppArgsControl,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        ypos += 1;

        const sshSingleArgDescr = _(
            settings.settings_schema
                .get_key('ssh-command-single-argument')
                .get_description()
        );
        const sshSingleArgLabel = new Gtk.Label({
            label: _('Pass SSH command line as a single argument:'),
            halign: Gtk.Align.START,
        });
        sshSingleArgLabel.set_tooltip_text(sshSingleArgDescr);
        const sshSingleArgControl = new Gtk.Switch({halign: Gtk.Align.END});
        sshSingleArgControl.set_tooltip_text(sshSingleArgDescr);
        grid.attach(sshSingleArgLabel, 1, ypos, 1, 1);
        grid.attach(sshSingleArgControl, 2, ypos, 1, 1);
        settings.bind(
            'ssh-command-single-argument',
            sshSingleArgControl,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        ypos += 1;

        const debugDescr = _(
            settings.settings_schema.get_key('debug').get_description()
        );
        const debugLabel = new Gtk.Label({
            label: _('Debug:'),
            halign: Gtk.Align.START,
        });
        debugLabel.set_tooltip_text(debugDescr);
        const debugControl = new Gtk.Switch({halign: Gtk.Align.END});
        debugControl.set_tooltip_text(debugDescr);
        grid.attach(debugLabel, 1, ypos, 1, 1);
        grid.attach(debugControl, 2, ypos, 1, 1);
        settings.bind(
            'debug',
            debugControl,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        ypos += 1;

        const copyrightLabel = new Gtk.Label({
            use_markup: true,
            label: `<span size="small">${_('Copyright © 2017-2026 Philippe Troin (<a href="https://github.com/F-i-f">F-i-f</a> on GitHub)')}</span>\n` +
                `<span size="small">${_('Copyright © 2013 Bernd Schlapsi')}</span>`,
            hexpand: true,
            halign: Gtk.Align.CENTER,
            margin_top: grid.margin_top,
        });
        grid.attach(copyrightLabel, 1, ypos, 2, 1);

        ypos += 1;

        const group = new Adw.PreferencesGroup();
        group.add(grid);
        const page = new Adw.PreferencesPage();
        page.add(group);

        window.add(page);
    }

    _on_click_terminal_app(settings, grid) {
        const dialog = new Gtk.Dialog({
            title: _('Choose Terminal Emulator'),
            transient_for: grid.get_root(),
            use_header_bar: true,
            modal: true,
        });
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Select'), Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.CANCEL);

        const chooser = new Gtk.AppChooserWidget({
            show_all: true,
            hexpand: true,
            vexpand: true,
        });

        chooser.connect('application-activated', (_w, _appInfo) => {
            dialog.response(Gtk.ResponseType.OK);
        });
        chooser.connect('application-selected', (_w, _appInfo) => {
            dialog.set_default_response(Gtk.ResponseType.OK);
        });
        dialog.get_content_area().append(chooser);

        dialog.connect('response', (dialogP, id) => {
            if (id === Gtk.ResponseType.OK) {
                const chosenAppId = chooser.get_app_info().get_id();
                settings.set_string('terminal-application', chosenAppId);
                if (chosenAppId in ArgumentsForTerminalApp) {
                    settings.set_string(
                        'terminal-application-arguments',
                        ArgumentsForTerminalApp[chosenAppId].args
                    );
                    settings.set_boolean(
                        'ssh-command-single-argument',
                        ArgumentsForTerminalApp[chosenAppId].single
                    );
                }
            }

            dialogP.destroy();
        });
        dialog.show();
    }

    _on_terminal_application_change(
        settings,
        termAppControlLabel,
        termAppControlImage
    ) {
        const appDesktopFile = settings.get_string('terminal-application');
        const appInfo = DesktopAppInfo.new(appDesktopFile);
        if (appInfo !== null) {
            termAppControlLabel.label = appInfo.get_display_name();
            termAppControlImage.gicon = appInfo.get_icon();
        } else {
            termAppControlLabel.label = appDesktopFile;
            termAppControlImage.gicon =
                Gio.icon_new_for_string('applications-other');
        }
    }
}
