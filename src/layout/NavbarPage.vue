<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref } from 'vue'
import IconNotification from '@/components/icons/IconNotification.vue'
import { ENV } from '@/config/env'
import IconDownChevron from '@/components/icons/IconDownChevron.vue'
import IconMenu from '@/components/icons/IconMenu.vue'

const isMobileMenuOpen = ref(false)
const isDropdownOpen = ref(false)
const isMobileServicesOpen = ref(false)
const notificationCount = 5

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (!isMobileMenuOpen.value) {
    isMobileServicesOpen.value = false
  }
}

const closeMenus = () => {
  isMobileMenuOpen.value = false
  isDropdownOpen.value = false
  isMobileServicesOpen.value = false
}
</script>
<template>
  <header class="border-b border-slate-200 bg-white">
    <nav class="mx-auto w-full px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <RouterLink
          to="/"
          class="text-xl font-semibold tracking-tight text-slate-900"
          @click="closeMenus"
        >
          {{ ENV.appName }}
        </RouterLink>

        <div class="hidden items-center gap-8 md:flex">
          <RouterLink to="/" class="text-sm font-medium text-slate-700 hover:text-slate-900">
            Home
          </RouterLink>
          <RouterLink
            :to="{ name: 'directIndex' }"
            class="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Direct
          </RouterLink>
          <RouterLink
            :to="{ name: 'salesforceIndex' }"
            class="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Salesforce
          </RouterLink>

          <div class="relative">
            <button
              type="button"
              class="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
              @click="isDropdownOpen = !isDropdownOpen"
            >
              Services
              <IconDownChevron />
            </button>

            <div
              v-if="isDropdownOpen"
              class="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-2 shadow-lg"
            >
              <RouterLink
                :to="{ name: 'microsoftIndex' }"
                class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Microsoft
              </RouterLink>
              <a href="#" class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >Development</a
              >
              <a href="#" class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >Support</a
              >
            </div>
          </div>
        </div>

        <div class="hidden items-center gap-3 md:flex">
          <button
            type="button"
            class="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="View notifications"
          >
            <span
              class="absolute -right-0.5 -top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white"
              >{{ notificationCount }}</span
            >
            <IconNotification />
          </button>
        </div>

        <button
          type="button"
          class="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
          @click="toggleMobileMenu"
        >
          <IconMenu :is-mobile-menu-open="isMobileMenuOpen" />
        </button>
      </div>

      <div v-if="isMobileMenuOpen" class="space-y-1 border-t border-slate-200 py-3 md:hidden">
        <RouterLink
          to="/"
          class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="closeMenus"
        >
          Home
        </RouterLink>
        <RouterLink
          :to="{ name: 'directIndex' }"
          class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="closeMenus"
        >
          Direct
        </RouterLink>
        <RouterLink
          :to="{ name: 'salesforceIndex' }"
          class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="closeMenus"
        >
          Salesforce
        </RouterLink>
        <div>
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            @click="isMobileServicesOpen = !isMobileServicesOpen"
          >
            <span>Services</span>
            <IconDownChevron />
          </button>

          <div
            class="overflow-hidden transition-all duration-300 ease-in-out"
            :class="isMobileServicesOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'"
          >
            <a
              href="#"
              class="block rounded-md px-6 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Microsoft
            </a>
            <a
              href="#"
              class="block rounded-md px-6 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Development
            </a>
            <a
              href="#"
              class="block rounded-md px-6 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Support
            </a>
          </div>
        </div>

        <div class="flex items-center justify-between px-3 pt-2">
          <button
            type="button"
            class="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="View notifications"
          >
            <span
              class="absolute -right-0.5 -top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white"
              >{{ notificationCount }}</span
            >
            <IconNotification />
          </button>
        </div>
      </div>
    </nav>
  </header>
</template>
