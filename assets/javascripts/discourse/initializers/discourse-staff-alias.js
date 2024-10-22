import { withPluginApi } from "discourse/lib/plugin-api";
import { CREATE_TOPIC, EDIT, REPLY } from "discourse/models/composer";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import I18n from "I18n";

const PLUGIN_ID = "discourse-staff-alias";

function initialize(api) {
  const currentUser = api.getCurrentUser();

  if (currentUser?.can_act_as_staff_alias) {
    api.modifySelectKit("composer-actions").prependContent((component) => {
      if (component.action === CREATE_TOPIC) {
        return [
          {
            name: I18n.t(
              "composer.composer_actions.as_staff_alias.create_topic.label"
            ),
            description: I18n.t(
              "composer.composer_actions.as_staff_alias.create_topic.desc"
            ),
            icon: "user-secret",
            id: "toggle_reply_as_staff_alias",
          },
        ];
      }
    });

    api.modifySelectKit("composer-actions").appendContent((component) => {
      if (
        component.topic?.details?.staff_alias_can_create_post &&
        (component.action === REPLY ||
          (component.action === EDIT &&
            component.get("post.post_type") !==
              component.get("site.post_types.whisper") &&
            !component.get("post.is_staff_aliased")))
      ) {
        return [
          {
            name: I18n.t(
              `composer.composer_actions.as_staff_alias.${component.action}.label`
            ),
            description: I18n.t(
              `composer.composer_actions.as_staff_alias.${component.action}.desc`
            ),
            icon: "user-secret",
            id: "toggle_reply_as_staff_alias",
          },
        ];
      }
    });

    api.modifyClass(
      "component:composer-presence-display",
      (ComposerPresenceDisplayComponent) =>
        class extends ComposerPresenceDisplayComponent {
          get state() {
            const { isReplyAsStaffAlias } = this.args.model;

            if (isReplyAsStaffAlias) {
              return "whisper";
            }

            return super.state;
          }
        }
    );

    api.modifyClass("component:composer-actions", {
      pluginId: PLUGIN_ID,

      toggleReplyAsStaffAliasSelected(options, model) {
        model.toggleProperty("replyAsStaffAlias");
        if (model.whisper) {
          model.set("whisper", false);
        }
      },

      toggleWhisperSelected(options, model) {
        this._super(...arguments);
        if (model.replyAsStaffAlias) {
          model.set("replyAsStaffAlias", false);
        }
      },
    });

    api.modifyClass("model:composer", {
      pluginId: PLUGIN_ID,
      replyAsStaffAlias: false,

      @observes("isReplyAsStaffAlias")
      _updateUser() {
        if (this.isReplyAsStaffAlias) {
          const props = {};

          if (this.topic) {
            props._originalUser = this.user;
            props.user = this.get("topic.staff_alias_user");
          }

          this.setProperties(props);
        } else {
          const props = {};

          if (this._originalUser) {
            props.user = this.get("_originalUser");
          }

          this.setProperties(props);
        }
      },

      @discourseComputed(
        "replyAsStaffAlias",
        "whisper",
        "editingPost",
        "post.is_staff_aliased"
      )
      isReplyAsStaffAlias(
        replyAsStaffAlias,
        whisper,
        editingPost,
        isStaffAliased
      ) {
        if (editingPost && isStaffAliased) {
          return true;
        } else {
          return !whisper && replyAsStaffAlias;
        }
      },
    });

    api.serializeOnCreate("as_staff_alias", "isReplyAsStaffAlias");
    api.serializeOnUpdate("as_staff_alias", "isReplyAsStaffAlias");
    api.serializeToTopic("as_staff_alias", "isReplyAsStaffAlias");

    api.includePostAttributes("aliased_username");
    api.includePostAttributes("is_staff_aliased");

  }
}

export default {
  name: "discourse-staff-alias",

  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (siteSettings.staff_alias_enabled) {
      withPluginApi("0.10.0", initialize);
    }
  },
};
