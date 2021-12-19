// Ssh Search Provider for Gnome Shell
// Copyright (C) 2019-2021 Philippe Troin (F-i-f on Github)
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

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const Logger = Me.imports.logger;

const ArgumentsForTerminalApp = {
    'guake.desktop':		  { args: '-n new -e', single: true },
    'rxvt.desktop':		  { args: '-e',        single: false },
    'org.gnome.Terminal.desktop': { args: '--',        single: false },
    'com.gexperts.Tilix.desktop': { args: '-e',        single: true },
    'xterm.desktop':		  { args: '-e',        single: true },
}

const SshSearchProviderSettings = GObject.registerClass(class SshSearchProviderSettings extends Gtk.Grid {

    setup() {
	this.margin_top = 12;
	this.margin_bottom = this.margin_top;
	this.margin_start = 48;
	this.margin_end = this.margin_start;
	this.row_spacing = 6;
	this.column_spacing = this.row_spacing;
	this.orientation = Gtk.Orientation.VERTICAL;

	this._settings = ExtensionUtils.getSettings();
	this._logger = new Logger.Logger('Ssh-Search-Provider/prefs');
	this._logger.set_debug(this._settings.get_boolean('debug'));

	let ypos = 1;
	let descr;

	this.title_label = new Gtk.Label({
	    use_markup: true,
	    label: '<span size="large" weight="heavy">'
		+_('SSH Search Provider Reborn')+'</span>',
	    hexpand: true,
	    halign: Gtk.Align.CENTER
	});
	this.attach(this.title_label, 1, ypos, 2, 1);

	ypos += 1;

	this.version_label = new Gtk.Label({
	    use_markup: true,
	    label: '<span size="small">'+_('Version')
		+ ' ' + this._logger.get_version() + '</span>',
	    hexpand: true,
	    halign: Gtk.Align.CENTER,
	});
	this.attach(this.version_label, 1, ypos, 2, 1);

	ypos += 1;

	this.link_label = new Gtk.Label({
	    use_markup: true,
	    label: '<span size="small"><a href="'+Me.metadata.url+'">'
		+ Me.metadata.url + '</a></span>',
	    hexpand: true,
	    halign: Gtk.Align.CENTER,
	    margin_bottom: this.margin_bottom
	});
	this.attach(this.link_label, 1, ypos, 2, 1);

	ypos += 1;


	descr = _(this._settings.settings_schema.get_key('terminal-application').get_description());
	this.term_app_label = new Gtk.Label({label: _("Terminal Application:"), halign: Gtk.Align.START});
	this.term_app_label.set_tooltip_text(descr);

	let app_desktop_file = this._settings.get_string('terminal-application');
	this.term_app_control_image  = new Gtk.Image();
	this.term_app_control_label = new Gtk.Label({label: app_desktop_file});
	let app_info = Gio.DesktopAppInfo.new(app_desktop_file);
	if (app_info != null) {
	    this.term_app_control_image.gicon = app_info.get_icon();
	    this.term_app_control_label.label = app_info.get_display_name();
	}
	this.term_app_control_box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, homogeneous: false, spacing: 10});
	if (this.term_app_control_box.append !== undefined) {
	    // Gtk4+
	    this.term_app_control_box.append(this.term_app_control_image);
	    this.term_app_control_box.append(this.term_app_control_label);
	} else {
	    // Gtk3-
	    this.term_app_control_box.add(this.term_app_control_image);
	    this.term_app_control_box.add(this.term_app_control_label);
	}
	this.term_app_control = new Gtk.Button({child: this.term_app_control_box});
	this.term_app_control.set_tooltip_text(descr);
	this.term_app_control.connect('clicked', this._on_click_terminal_app.bind(this));

	this.attach(this.term_app_label,   1, ypos, 1, 1);
	this.attach(this.term_app_control, 2, ypos, 1, 1);
	this._settings.connect('changed::terminal-application', this._on_terminal_application_change.bind(this));

	ypos += 1;

	descr = _(this._settings.settings_schema.get_key('terminal-application-arguments').get_description());
	this.term_app_args_label = new Gtk.Label({label: _("Arguments:"), halign: Gtk.Align.START});
	this.term_app_args_label.set_tooltip_text(descr);
	this.term_app_args_control = new Gtk.Entry();
	this.term_app_args_control.set_tooltip_text(descr);
	this.attach(this.term_app_args_label,   1, ypos, 1, 1);
	this.attach(this.term_app_args_control, 2, ypos, 1, 1);
	this._settings.bind('terminal-application-arguments', this.term_app_args_control, 'text', Gio.SettingsBindFlags.DEFAULT);

	ypos += 1;

	descr = _(this._settings.settings_schema.get_key('ssh-command-single-argument').get_description());
	this.ssh_single_arg_label = new Gtk.Label({label: _("Pass SSH command line as a single argument:"), halign: Gtk.Align.START});
	this.ssh_single_arg_label.set_tooltip_text(descr);
	this.ssh_single_arg_control = new Gtk.Switch({ halign: Gtk.Align.END });
	this.ssh_single_arg_control.set_tooltip_text(descr);
	this.attach(this.ssh_single_arg_label,   1, ypos, 1, 1);
	this.attach(this.ssh_single_arg_control, 2, ypos, 1, 1);
	this._settings.bind('ssh-command-single-argument', this.ssh_single_arg_control, 'active', Gio.SettingsBindFlags.DEFAULT);

	ypos += 1;

	descr = _(this._settings.settings_schema.get_key('debug').get_description());
	this.debug_label = new Gtk.Label({label: _("Debug:"), halign: Gtk.Align.START});
	this.debug_label.set_tooltip_text(descr);
	this.debug_control = new Gtk.Switch({halign: Gtk.Align.END});
	this.debug_control.set_tooltip_text(descr);
	this.attach(this.debug_label,   1, ypos, 1, 1);
	this.attach(this.debug_control, 2, ypos, 1, 1);
	this._settings.bind('debug', this.debug_control, 'active', Gio.SettingsBindFlags.DEFAULT);

	ypos += 1;

	this.copyright_label = new Gtk.Label({
	    use_markup: true,
	    label: '<span size="small">'
		+ _('Copyright © 2017-2021 Philippe Troin (<a href="https://github.com/F-i-f">F-i-f</a> on GitHub)')
		+ '</span>\n<span size="small">'
		+ _('Copyright © 2013 Bernd Schlapsi')
		+ '</span>',
	    hexpand: true,
	    halign: Gtk.Align.CENTER,
	    margin_top: this.margin_bottom
	});
	this.attach(this.copyright_label, 1, ypos, 2, 1);

	ypos += 1;
    }

    _on_click_terminal_app() {
	let root;
	if (this.get_root !== undefined) {
	    // Gtk4+
	    root = this.get_root();
	} else {
	    // Gtk3-
	    root = this.get_toplevel()
	}
	let dialog = new Gtk.Dialog({ title: _("Choose Terminal Emulator"),
				      transient_for: root,
				      use_header_bar: true,
				      modal: true });
	dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
	let addButton = dialog.add_button(_("Select"), Gtk.ResponseType.OK);
	dialog.set_default_response(Gtk.ResponseType.CANCEL);

	let chooser = new Gtk.AppChooserWidget({ show_all: true, hexpand: true, vexpand:true });

	chooser.connect('application-activated', (w, appInfo) => {
	    dialog.response(Gtk.ResponseType.OK);
	});
	chooser.connect('application-selected', (w, appInfo) => {
	    dialog.set_default_response(Gtk.ResponseType.OK);
	});
	if (dialog.get_content_area().append !== undefined) {
	    // Gtk4+
	    dialog.get_content_area().append(chooser);
	} else {
	    dialog.get_content_area().add(chooser);
	    // Gtk3-
	}
	dialog._settings = this._settings;

	dialog.connect('response', (dialog, id) => {
	    if (id == Gtk.ResponseType.OK) {
		let chosen_app_id = chooser.get_app_info().get_id();
		this._settings.set_string('terminal-application', chosen_app_id);
		if (chosen_app_id in ArgumentsForTerminalApp) {
		    this._settings.set_string('terminal-application-arguments', ArgumentsForTerminalApp[chosen_app_id].args);
		    this._settings.set_boolean('ssh-command-single-argument', ArgumentsForTerminalApp[chosen_app_id].single);
		}
	    }

	    dialog.destroy();
	});
	if (dialog.show_all !== undefined) {
	    // Gtk3-
	    dialog.show_all();
	} else {
	    // Gtk4+
	    dialog.show();
	}
    }

    _on_terminal_application_change() {
	let app_desktop_file = this._settings.get_string('terminal-application');
	let app_info = Gio.DesktopAppInfo.new(app_desktop_file);
	if (app_info != null) {
	    this.term_app_control_label.label = app_info.get_display_name();
	    this.term_app_control_image.gicon = app_info.get_icon();
	} else {
	    this.term_app_control_label.label = app_desktop_file;
	}
    }

});

function init() {
    ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
    let widget = new SshSearchProviderSettings();
    widget.setup();
    // show_all() is only available/necessary on GTK < 4.0.
    if (widget.show_all !== undefined) {
	widget.show_all();
    }

    return widget;
}
