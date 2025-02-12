// -*- indent-tabs-mode: nil; -*-
// Ssh Search Provider for Gnome Shell
// Copyright (C) 2019-2025 Philippe Troin (F-i-f on Github)
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

        const title_label = new Gtk.Label({
            use_markup: true,
            label:
                '<span size="large" weight="heavy">' +
                _('SSH Search Provider Reborn') +
                '</span>',
            hexpand: true,
            halign: Gtk.Align.CENTER,
        });
        grid.attach(title_label, 1, ypos, 2, 1);

        ypos += 1;

        const version_label = new Gtk.Label({
            use_markup: true,
            label:
                '<span size="small">' +
                _('Version') +
                ' ' +
                logger.get_version() +
                '</span>',
            hexpand: true,
            halign: Gtk.Align.CENTER,
        });
        grid.attach(version_label, 1, ypos, 2, 1);

        ypos += 1;

        const link_label = new Gtk.Label({
            use_markup: true,
            label:
                '<span size="small"><a href="' +
                this.metadata.url +
                '">' +
                this.metadata.url +
                '</a></span>',
            hexpand: true,
            halign: Gtk.Align.CENTER,
            margin_bottom: grid.margin_bottom,
        });
        grid.attach(link_label, 1, ypos, 2, 1);

        ypos += 1;

        const term_app_descr = _(
            settings.settings_schema
                .get_key('terminal-application')
                .get_description()
        );
        const term_app_label = new Gtk.Label({
            label: _('Terminal Application:'),
            halign: Gtk.Align.START,
        });
        term_app_label.set_tooltip_text(term_app_descr);

        const term_app_control_image = new Gtk.Image();
        const term_app_control_label = new Gtk.Label();
        this._on_terminal_application_change(
            settings,
            term_app_control_label,
            term_app_control_image
        );
        const term_app_control_box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            spacing: 10,
        });
        term_app_control_box.append(term_app_control_image);
        term_app_control_box.append(term_app_control_label);
        const term_app_control = new Gtk.Button({child: term_app_control_box});
        term_app_control.set_tooltip_text(term_app_descr);
        term_app_control.connect('clicked', () => {
            this._on_click_terminal_app(settings, grid);
        });

        grid.attach(term_app_label, 1, ypos, 1, 1);
        grid.attach(term_app_control, 2, ypos, 1, 1);
        settings.connect('changed::terminal-application', () => {
            this._on_terminal_application_change(
                settings,
                term_app_control_label,
                term_app_control_image
            );
        });

        ypos += 1;

        const term_app_args_descr = _(
            settings.settings_schema
                .get_key('terminal-application-arguments')
                .get_description()
        );
        const term_app_args_label = new Gtk.Label({
            label: _('Arguments:'),
            halign: Gtk.Align.START,
        });
        term_app_args_label.set_tooltip_text(term_app_args_descr);
        const term_app_args_control = new Gtk.Entry();
        term_app_args_control.set_tooltip_text(term_app_args_descr);
        grid.attach(term_app_args_label, 1, ypos, 1, 1);
        grid.attach(term_app_args_control, 2, ypos, 1, 1);
        settings.bind(
            'terminal-application-arguments',
            term_app_args_control,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        ypos += 1;

        const ssh_single_arg_descr = _(
            settings.settings_schema
                .get_key('ssh-command-single-argument')
                .get_description()
        );
        const ssh_single_arg_label = new Gtk.Label({
            label: _('Pass SSH command line as a single argument:'),
            halign: Gtk.Align.START,
        });
        ssh_single_arg_label.set_tooltip_text(ssh_single_arg_descr);
        const ssh_single_arg_control = new Gtk.Switch({halign: Gtk.Align.END});
        ssh_single_arg_control.set_tooltip_text(ssh_single_arg_descr);
        grid.attach(ssh_single_arg_label, 1, ypos, 1, 1);
        grid.attach(ssh_single_arg_control, 2, ypos, 1, 1);
        settings.bind(
            'ssh-command-single-argument',
            ssh_single_arg_control,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        ypos += 1;

        const debug_descr = _(
            settings.settings_schema.get_key('debug').get_description()
        );
        const debug_label = new Gtk.Label({
            label: _('Debug:'),
            halign: Gtk.Align.START,
        });
        debug_label.set_tooltip_text(debug_descr);
        const debug_control = new Gtk.Switch({halign: Gtk.Align.END});
        debug_control.set_tooltip_text(debug_descr);
        grid.attach(debug_label, 1, ypos, 1, 1);
        grid.attach(debug_control, 2, ypos, 1, 1);
        settings.bind(
            'debug',
            debug_control,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        ypos += 1;

        const copyright_label = new Gtk.Label({
            use_markup: true,
            label:
                '<span size="small">' +
                _(
                    'Copyright © 2017-2025 Philippe Troin (<a href="https://github.com/F-i-f">F-i-f</a> on GitHub)'
                ) +
                '</span>\n<span size="small">' +
                _('Copyright © 2013 Bernd Schlapsi') +
                '</span>',
            hexpand: true,
            halign: Gtk.Align.CENTER,
            margin_top: grid.margin_top,
        });
        grid.attach(copyright_label, 1, ypos, 2, 1);

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

        dialog.connect('response', (dialog_p, id) => {
            if (id === Gtk.ResponseType.OK) {
                const chosen_app_id = chooser.get_app_info().get_id();
                settings.set_string('terminal-application', chosen_app_id);
                if (chosen_app_id in ArgumentsForTerminalApp) {
                    settings.set_string(
                        'terminal-application-arguments',
                        ArgumentsForTerminalApp[chosen_app_id].args
                    );
                    settings.set_boolean(
                        'ssh-command-single-argument',
                        ArgumentsForTerminalApp[chosen_app_id].single
                    );
                }
            }

            dialog_p.destroy();
        });
        dialog.show();
    }

    _on_terminal_application_change(
        settings,
        term_app_control_label,
        term_app_control_image
    ) {
        const app_desktop_file = settings.get_string('terminal-application');
        const app_info = Gio.DesktopAppInfo.new(app_desktop_file);
        if (app_info !== null) {
            term_app_control_label.label = app_info.get_display_name();
            term_app_control_image.gicon = app_info.get_icon();
        } else {
            term_app_control_label.label = app_desktop_file;
            term_app_control_image.gicon =
                Gio.icon_new_for_string('applications-other');
        }
    }
}
