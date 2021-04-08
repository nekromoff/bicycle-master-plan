<?php
namespace App\Forms;

use Kris\LaravelFormBuilder\Form;

class AddMarkerForm extends Form
{
    public function buildForm()
    {
        $email = '';
        if ($this->getData('email')) {
            $email = $this->getData('email');
        }

        $this
            ->add('name', 'text', ['label' => 'Title:', 'wrapper' => ['class' => 'form-group input-group-sm']])
            ->add('description', 'textarea', ['label' => 'Description:', 'attr' => ['rows' => 3], 'wrapper' => ['class' => 'form-group input-group-sm'], 'help_block' => [
                'text' => 'Description or URL',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]])
            ->add('file', 'file', ['label' => 'Photo:', 'attr' => ['accept' => '.png,.PNG,.jpg,.jpeg,.JPG,.JPEG,.PDF,.pdf', 'capture'], 'wrapper' => ['class' => 'form-group input-group-sm'], 'help_block' => [
                'text' => 'Photo or image - JPG, PNG or PDF allowed. Markers without photos will usually not be approved.',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]]);
        if ($this->getData('editable_layer_id') and isset(config('map.layers')[$this->getData('editable_layer_id')]['types'])) {
            $types = [];
            foreach (config('map.layers')[$this->getData('editable_layer_id')]['types'] as $key => $type) {
                $types[$key] = strip_tags($type['name']);
            }
            $this->add('type', 'choice', ['label' => 'Type:', 'choices' => $types, 'wrapper' => ['class' => 'form-group input-group-sm']]);
        }
        $this
            ->add('email', 'email', ['label' => 'Email:', 'value' => $email, 'wrapper' => ['class' => 'form-group input-group-sm'], 'help_block' => [
                'text' => 'Optional - if you want us to be able to contact you to send you thanks',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]])
            ->add('lat', 'hidden')
            ->add('lon', 'hidden')
            ->add('original_id', 'hidden', ['value' => 0])
            ->add('submit', 'submit', ['label' => 'Create marker', 'attr' => ['class' => 'btn btn-primary btn-block'], 'help_block' => [
                'text' => 'Submitted markers are to be verified pending approval by an administrator.',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]]);
    }
}
