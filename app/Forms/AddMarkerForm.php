<?php
namespace App\Forms;

use Kris\LaravelFormBuilder\Form;

class AddMarkerForm extends Form
{
    public function buildForm()
    {
        $this
            ->add('name', 'text', ['label' => 'Title:', 'wrapper' => ['class' => 'form-group input-group-sm']])
            ->add('description', 'textarea', ['label' => 'Description:', 'attr' => ['rows' => 3], 'wrapper' => ['class' => 'form-group input-group-sm'], 'help_block' => [
                'text' => 'Description or URL',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]])
            ->add('file', 'file', ['label' => 'Photo:', 'attr' => ['accept' => '.png,.PNG,.jpg,.jpeg,.JPG,.JPEG', 'capture'], 'wrapper' => ['class' => 'form-group input-group-sm'], 'help_block' => [
                'text' => 'Photo or image - JPG or PNG allowed.',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]]);
        if ($this->formOptions['editable_layer_id'] and isset(config('map.layers')[$this->formOptions['editable_layer_id']]['editable_types'])) {
            $types = [];
            foreach (config('map.layers')[$this->formOptions['editable_layer_id']]['editable_types'] as $key => $type) {
                $types[$key] = $type['name'];
            }
            $this->add('type', 'choice', ['label' => 'Type:', 'choices' => $types, 'wrapper' => ['class' => 'form-group input-group-sm']]);
        }
        $this->add('lat', 'hidden')
            ->add('lon', 'hidden')
            ->add('submit', 'submit', ['label' => 'Create marker', 'attr' => ['class' => 'btn btn-primary btn-block']]);
    }
}
